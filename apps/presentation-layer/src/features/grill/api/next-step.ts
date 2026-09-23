import type { BlockId, NodeId } from '@/shared/api/contracts/common';
import type { InternalGrillSession, InternalTask } from '@/shared/api/store/domain';
import { BLOCK_ORDER, NODES_BY_BLOCK } from '@/shared/api/store/nodes';

/**
 * Только то подмножество `InternalTask`, которое читает `nextStep`. Вызывающая
 * сторона (`submit-turn.ts`) считает следующий шаг на ПРОЕЦИРУЕМОМ состоянии
 * (какими будут поля после записи ответа) ДО открытия транзакции, не
 * мутируя реальную задачу в сторе — поэтому достаточно `fields`/`criteria`,
 * а не полного `InternalTask`.
 */
export type NextStepTaskView = Pick<InternalTask, 'fields' | 'criteria'>;

/**
 * INTEGRATION(ADR-004 §2): чистая функция `nextStep(session, task)`.
 * Полная версия — дерево прожарки с ветками FR-1.8 («данных нет», профиль
 * результата) и обработкой pushback (FR-1.7) — принадлежит владельцу
 * ADR-004 (`src/entities/grill/model`). Эта версия покрывает порядок блоков
 * (FR-1.3), пропуск закрытых узлов (FR-1.6) и минимум из 3 вопросов
 * (FR-1.4), достаточных для демонстрации контракта `POST /grill/turn`.
 */
export type NextStepResult =
  | { kind: 'question'; node: NodeId; isPushback: boolean }
  | { kind: 'checkpoint'; block: BlockId }
  | { kind: 'done' };

function isNodeOpen(task: NextStepTaskView, node: NodeId): boolean {
  if (node === 'criteria.items') {
    return task.criteria.some((c) => c.state === 'empty');
  }
  const field = task.fields.get(node);
  return !field || field.state === 'empty';
}

function blockHasOpenNode(task: NextStepTaskView, block: BlockId): boolean {
  return NODES_BY_BLOCK[block].some((node) => isNodeOpen(task, node));
}

export function nextStep(session: InternalGrillSession, task: NextStepTaskView): NextStepResult {
  const blockIndex = BLOCK_ORDER.indexOf(session.currentBlock);
  for (let i = blockIndex; i < BLOCK_ORDER.length; i += 1) {
    const block = BLOCK_ORDER[i];
    if (blockHasOpenNode(task, block)) {
      const openNode = NODES_BY_BLOCK[block].find((node) => isNodeOpen(task, node));
      if (openNode) {
        // FR-1.7 (одно уточнение на узел): полная логика pushback
        // принадлежит ADR-004; здесь всегда задаём обычный вопрос.
        return { kind: 'question', node: openNode, isPushback: false };
      }
    }
    if (i === blockIndex) {
      // Текущий блок закрыт — выдаём checkpoint блока (FR-1.9), кроме случая
      // когда ещё не задано минимум 3 вопроса (FR-1.4): тогда переходим к
      // следующему блоку с открытыми узлами, не завершая прожарку раньше срока.
      if (session.questionsAsked >= 3 || i === BLOCK_ORDER.length - 1) {
        return { kind: 'checkpoint', block };
      }
    }
  }
  return { kind: 'done' };
}
