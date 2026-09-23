import type { AiLogResponse } from '@/shared/api/contracts/ai-log';
import type { DemoActor } from '@/shared/api/demo-actor';
import { forbidden } from '@/shared/api/errors';
import { getTaskOrThrow, store, toApiAiLog } from '@/shared/api/store';

/**
 * GET /api/ai-log?taskId= (AI-14, ADR-008 §4): доступен роли business и
 * только по своим задачам.
 */
export function getAiLog(actor: DemoActor, taskId: string): AiLogResponse {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Журнал ИИ видит только бизнес — владелец задачи.');
  }
  return { entries: store.aiLogs.filter((entry) => entry.taskId === taskId).map(toApiAiLog) };
}
