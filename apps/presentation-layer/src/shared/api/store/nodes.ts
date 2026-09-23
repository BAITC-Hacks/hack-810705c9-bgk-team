import type { BlockId, NodeId } from '../contracts/common';

/**
 * Раздел 6.1 ТЗ: 17 узлов рейтинга, их баллы и блок. Единственный источник
 * весов для расчёта score() во всех use-case (ADR-005 §владелец должен
 * подтвердить этот список при подключении своей реализации — веса и порядок
 * блоков переписаны из спецификации без изменений).
 */
export const NODE_META: Record<NodeId, { block: BlockId; label: string; weight: number }> = {
  'context.current': { block: 'context', label: 'Как процесс устроен сейчас', weight: 5 },
  'context.size': { block: 'context', label: 'Насколько велика проблема', weight: 5 },
  'context.change': { block: 'context', label: 'Что должно измениться', weight: 10 },
  'data.what': { block: 'data', label: 'Какие данные, API, документация', weight: 10 },
  'data.volume': { block: 'data', label: 'Объём, период', weight: 5 },
  'data.sample': { block: 'data', label: 'Пример, схема, Swagger', weight: 5 },
  'result.artifact': { block: 'result', label: 'Что сдаём', weight: 10 },
  'result.acceptance': { block: 'result', label: 'Как сдаём', weight: 5 },
  'criteria.items': { block: 'criteria', label: 'По каким метрикам примете', weight: 15 },
  'constraints.deadline': { block: 'constraints', label: 'Срок', weight: 4 },
  'constraints.stack': { block: 'constraints', label: 'Стек, роли', weight: 3 },
  'constraints.other': { block: 'constraints', label: 'Иные границы', weight: 3 },
  'users.role': { block: 'users', label: 'Кто пользователь', weight: 5 },
  'users.scale': { block: 'users', label: 'Сколько их, в какой ситуации', weight: 5 },
  'link.contact': { block: 'link', label: 'Кому писать', weight: 4 },
  'link.cadence': { block: 'link', label: 'Формат консультаций', weight: 3 },
  'link.response': { block: 'link', label: 'Порядок обратной связи', weight: 3 },
};

/** FR-1.3: порядок блоков прожарки. */
export const BLOCK_ORDER: BlockId[] = [
  'context',
  'result',
  'criteria',
  'data',
  'constraints',
  'users',
  'link',
];

export const NODES_BY_BLOCK: Record<BlockId, NodeId[]> = BLOCK_ORDER.reduce(
  (acc, block) => {
    acc[block] = (Object.keys(NODE_META) as NodeId[]).filter(
      (node) => NODE_META[node].block === block,
    );
    return acc;
  },
  {} as Record<BlockId, NodeId[]>,
);

export const ALL_NODES: NodeId[] = Object.keys(NODE_META) as NodeId[];
