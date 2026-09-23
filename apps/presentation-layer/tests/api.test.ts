import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NextRequest } from 'next/server';

import { POST as createTaskRoute } from '../app/api/tasks/route';
import { PATCH as patchFieldRoute } from '../app/api/tasks/[id]/fields/[node]/route';
import { POST as grillTurnRoute } from '../app/api/tasks/[id]/grill/turn/route';
import { POST as decisionRoute } from '../app/api/proposals/[id]/decision/route';

/**
 * ADR-009 §8 (проверка): прогон route handler'ов напрямую, без поднятия
 * dev-сервера. `NextRequest.cookies`/`.headers` не требуют контекста
 * рендера Next, в отличие от `next/headers` (см. `demo-actor.ts`), поэтому
 * такой вызов надёжен вне `next dev`/`next start`.
 *
 * AI-порт (`getAiPort()`) в этих тестах — реальный `mastraAiPort`, но
 * `MASTRA_API_URL` не поднят: соединение отклоняется немедленно, что и
 * проверяет T-13/T-15 (Mastra недоступна → 200 с `fallbackUsed: true`) без
 * подмены модуля.
 */

function req(url: string, opts: { method: string; role: 'business' | 'team'; actorId: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method,
    headers: {
      'content-type': 'application/json',
      'x-demo-role': opts.role,
      'x-demo-actor': opts.actorId,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function createDraftTask(businessId: string) {
  const response = await createTaskRoute(
    req('/api/tasks', {
      method: 'POST',
      role: 'business',
      actorId: businessId,
      body: {
        draftText:
          'Нужно снизить количество ошибок при ручном вводе накладных на складе, сейчас теряем время каждую неделю.',
        topic: 'логистика',
        format: 'practice',
      },
    }),
  );
  assert.equal(response.status, 201);
  return response.json();
}

describe('POST /api/tasks — валидация черновика (FR-1.1, NFR-4)', () => {
  it('черновик короче 20 символов -> 422 с русским текстом', async () => {
    const response = await createTaskRoute(
      req('/api/tasks', {
        method: 'POST',
        role: 'business',
        actorId: 'biz-short',
        body: { draftText: 'Слишком коротко', topic: 'ритейл', format: 'practice' },
      }),
    );
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.error.code, 'validation_error');
    assert.match(body.error.message, /20 символ/);
  });

  it('невалидный JSON -> 400', async () => {
    const badRequest = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-demo-role': 'business' },
      body: '{ не json',
    });
    const response = await createTaskRoute(badRequest);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'invalid_json');
  });

  it('создаёт задачу и возвращает checkpoint черновика', async () => {
    const { task, draftSummary, fallbackUsed } = await createDraftTask('biz-create');
    assert.equal(task.status, 'draft');
    assert.equal(draftSummary.block, 'draft');
    assert.equal(typeof fallbackUsed, 'boolean');
  });
});

describe('POST /api/tasks/:id/grill/turn — роли, версия, fallback (ADR-004 §6, ADR-003 §5)', () => {
  it('неизвестная задача -> 404', async () => {
    const response = await grillTurnRoute(
      req('/api/tasks/does-not-exist/grill/turn', {
        method: 'POST',
        role: 'business',
        actorId: 'biz-1',
        body: { answer: 'ответ', sessionVersion: 0 },
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    assert.equal(response.status, 404);
  });

  it('роль «команда» не может отвечать на прожарку -> 403', async () => {
    const { task } = await createDraftTask('biz-role');
    const response = await grillTurnRoute(
      req(`/api/tasks/${task.id}/grill/turn`, {
        method: 'POST',
        role: 'team',
        actorId: 'team-botforge',
        body: { answer: 'ответ', sessionVersion: 0 },
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error.code, 'forbidden');
  });

  it('устаревшая sessionVersion -> 409 (T-повторная отправка)', async () => {
    const { task } = await createDraftTask('biz-version');

    const first = await grillTurnRoute(
      req(`/api/tasks/${task.id}/grill/turn`, {
        method: 'POST',
        role: 'business',
        actorId: 'biz-version',
        body: { answer: 'Процесс делаем вручную в таблице', sessionVersion: 0 },
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    assert.equal(first.status, 200);

    // Повторная отправка с той же (уже устаревшей) версией.
    const second = await grillTurnRoute(
      req(`/api/tasks/${task.id}/grill/turn`, {
        method: 'POST',
        role: 'business',
        actorId: 'biz-version',
        body: { answer: 'Ещё один ответ', sessionVersion: 0 },
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    assert.equal(second.status, 409);
    const body = await second.json();
    assert.equal(body.error.code, 'conflict');
  });

  it('Mastra недоступна -> 200 с fallbackUsed: true, ход всё равно записан (T-13/T-15)', async () => {
    const { task } = await createDraftTask('biz-fallback');

    const response = await grillTurnRoute(
      req(`/api/tasks/${task.id}/grill/turn`, {
        method: 'POST',
        role: 'business',
        actorId: 'biz-fallback',
        body: { answer: 'Процесс делаем вручную, теряем 3 часа в неделю', sessionVersion: 0 },
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.fallbackUsed, true);
    // Версия сессии продвинулась -> транзакция записи выполнилась ПОСЛЕ
    // того, как AI-вызов (снаружи транзакции, ADR-009 §5) завершился ошибкой
    // и код перешёл к шаблону. Это структурно подтверждает порядок
    // «сначала AI (или его неудача), затем короткая запись».
    assert.equal(body.sessionVersion, 1);
    assert.ok(body.next.kind === 'question' || body.next.kind === 'checkpoint');
  });
});

describe('PATCH /api/tasks/:id/fields/:node — владение (ADR-008 §2)', () => {
  it('чужой бизнес не может редактировать поле -> 403', async () => {
    const { task } = await createDraftTask('biz-owner');
    const response = await patchFieldRoute(
      req(`/api/tasks/${task.id}/fields/context.current`, {
        method: 'PATCH',
        role: 'business',
        actorId: 'biz-intruder',
        body: { value: 'Чужая правка' },
      }),
      { params: Promise.resolve({ id: task.id, node: 'context.current' }) },
    );
    assert.equal(response.status, 403);
  });
});

describe('POST /api/proposals/:id/decision — причина отклонения (FR-7.5, T-16)', () => {
  it('отклонение без причины отклоняется схемой -> 422', async () => {
    const response = await decisionRoute(
      req('/api/proposals/whatever/decision', {
        method: 'POST',
        role: 'business',
        actorId: 'biz-1',
        body: { action: 'reject' },
      }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.error.code, 'validation_error');
  });

  it('неизвестный отклик -> 404', async () => {
    const response = await decisionRoute(
      req('/api/proposals/does-not-exist/decision', {
        method: 'POST',
        role: 'business',
        actorId: 'biz-1',
        body: { action: 'reject', reason: 'roles' },
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    assert.equal(response.status, 404);
  });
});
