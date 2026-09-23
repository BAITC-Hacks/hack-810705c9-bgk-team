import type { NodeId } from '@/shared/api/contracts/common';
import { nodeIdSchema } from '@/shared/api/contracts/common';
import type { PatchFieldRequest, PatchFieldResponse } from '@/shared/api/contracts/fields';
import type { DemoActor } from '@/shared/api/demo-actor';
import { businessError, forbidden } from '@/shared/api/errors';
import { getTaskOrThrow, toApiField } from '@/shared/api/store';
import { calculateScore } from '@/shared/api/store/scoring';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * ADR-004 §5 (FR-2.3, T-6): правка ставит state=suggested, source=manual и
 * снимает баллы до повторного подтверждения. `{action:'confirm'}` — ручное
 * подтверждение вне сводки блока (ADR-009 §6), например после правки в
 * редакторе карточки.
 */
export async function patchField(
  actor: DemoActor,
  taskId: string,
  nodeParam: string,
  request: PatchFieldRequest,
): Promise<PatchFieldResponse> {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Редактировать карточку может только бизнес — владелец задачи.');
  }

  const node = nodeIdSchema.safeParse(nodeParam);
  if (!node.success) {
    throw businessError('Неизвестный узел карточки.', { node: nodeParam });
  }
  const nodeId: NodeId = node.data;

  return inMemoryTransaction(async () => {
    const scoreBefore = calculateScore(task);
    const existing = task.fields.get(nodeId);

    if (request.action === 'confirm') {
      if (!existing) {
        throw businessError('Нельзя подтвердить пустое поле.');
      }
      existing.state = 'confirmed';
    } else {
      task.fields.set(nodeId, {
        node: nodeId,
        value: request.value,
        state: 'suggested',
        notApplicable: request.notApplicable ?? false,
        naNote: request.naNote,
        source: 'manual',
        sourceQuote: existing?.sourceQuote,
        sourceTurnId: existing?.sourceTurnId,
      });
    }

    const scoreAfter = calculateScore(task);
    const field = task.fields.get(nodeId)!;
    return { field: toApiField(field), scoreDelta: scoreAfter - scoreBefore };
  });
}
