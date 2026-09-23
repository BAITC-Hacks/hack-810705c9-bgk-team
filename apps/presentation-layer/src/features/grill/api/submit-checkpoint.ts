import type {
  GrillCheckpointRequest,
  GrillCheckpointResponse,
} from '@/shared/api/contracts/grill';
import type { DemoActor } from '@/shared/api/demo-actor';
import { forbidden } from '@/shared/api/errors';
import { getTaskOrThrow, toApiField } from '@/shared/api/store';
import { NODES_BY_BLOCK } from '@/shared/api/store/nodes';
import { calculateScore } from '@/shared/api/store/scoring';
import { inMemoryTransaction } from '@/shared/db/transaction';

/**
 * ADR-004 §4: POST /grill/checkpoint {block, action: confirm|edit} в одной
 * транзакции переводит `suggested`-поля блока в `confirmed` (action=confirm)
 * и запускает пересчёт (ADR-005). `action=edit` оставляет поля как есть —
 * бизнес правит их через `PATCH /fields/:node` и подтверждает заново.
 */
export async function submitGrillCheckpoint(
  actor: DemoActor,
  taskId: string,
  request: GrillCheckpointRequest,
): Promise<GrillCheckpointResponse> {
  const task = getTaskOrThrow(taskId);
  if (actor.role !== 'business' || actor.businessId !== task.businessId) {
    throw forbidden('Подтверждать блок карточки может только бизнес — владелец задачи.');
  }

  return inMemoryTransaction(async () => {
    const scoreBefore = calculateScore(task);

    if (request.action === 'confirm') {
      for (const node of NODES_BY_BLOCK[request.block]) {
        const field = task.fields.get(node);
        if (field && field.state === 'suggested') {
          field.state = 'confirmed';
        }
      }
      if (request.block === 'criteria') {
        for (const criterion of task.criteria) {
          if (criterion.state === 'suggested') criterion.state = 'confirmed';
        }
      }
    }

    const scoreAfter = calculateScore(task);
    const fields = NODES_BY_BLOCK[request.block]
      .map((node) => task.fields.get(node))
      .filter((field): field is NonNullable<typeof field> => !!field)
      .map(toApiField);

    return {
      block: request.block,
      fields,
      scoreDelta: scoreAfter - scoreBefore,
    };
  });
}

