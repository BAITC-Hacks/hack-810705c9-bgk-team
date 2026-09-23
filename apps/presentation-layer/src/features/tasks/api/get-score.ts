import type { GetScoreResponse } from '@/shared/api/contracts/tasks';
import type { DemoActor } from '@/shared/api/demo-actor';
import { forbidden } from '@/shared/api/errors';
import { getTaskOrThrow } from '@/shared/api/store';
import { calculateScore, levelForScore, missingNodes, nextStep, scoreBreakdown } from '@/shared/api/store/scoring';

/**
 * GET /api/tasks/:id/score (FR-3.3–3.5): расшифровка, недостающие сведения,
 * следующий шаг. Читает задачу — доступно бизнесу-владельцу; команда видит
 * только опубликованные задачи через каталог/рекомендации, не этот эндпоинт
 * (ADR-008 §3).
 */
export function getScore(actor: DemoActor, taskId: string): GetScoreResponse {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Расшифровку рейтинга видит только бизнес — владелец задачи.');
  }

  const score = calculateScore(task);
  return {
    score,
    level: levelForScore(score),
    breakdown: scoreBreakdown(task),
    missing: missingNodes(task),
    nextStep: nextStep(task),
  };
}
