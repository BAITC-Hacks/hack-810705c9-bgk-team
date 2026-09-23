import type { NodeId, ReadinessLevel } from '../contracts/common';
import type { InternalTask } from './domain';
import { ALL_NODES, NODE_META } from './nodes';

/**
 * INTEGRATION(ADR-005): раздел 6.1 ТЗ — баллы только за confirmed (FR-3.2).
 * `criteria.items` (15 баллов) — особая ветка: до 3 подтверждённых критериев,
 * 5 баллов за критерий с числовым порогом, 2 — без числа (раздел 6.1).
 * Владелец ADR-005 заменяет эту функцию на версию с историей ScoreEvent
 * (FR-3.8) поверх реальной схемы; сигнатура `score(task)` может остаться той
 * же для остальных use-case.
 */
export function calculateScore(task: InternalTask): number {
  let total = 0;
  for (const node of ALL_NODES) {
    if (node === 'criteria.items') continue;
    const field = task.fields.get(node);
    if (field?.state === 'confirmed' && !field.notApplicable) {
      total += NODE_META[node].weight;
    } else if (field?.state === 'confirmed' && field.notApplicable && node === 'constraints.other') {
      // «нет» засчитывается для constraints.other (раздел 6.1, примечание).
      total += NODE_META[node].weight;
    }
  }
  const criteriaPoints = task.criteria
    .filter((criterion) => criterion.state === 'confirmed')
    .reduce((sum, criterion) => sum + (criterion.thresholdHasNumber ? 5 : 2), 0);
  total += Math.min(criteriaPoints, NODE_META['criteria.items'].weight);
  return Math.min(100, total);
}

export function levelForScore(score: number): ReadinessLevel {
  if (score < 40) return 'draft';
  if (score < 70) return 'working';
  if (score < 90) return 'ready';
  return 'priority';
}

export type ScoreBreakdownItem = {
  node: NodeId;
  label: string;
  earned: number;
  max: number;
  reason: string;
};

export function scoreBreakdown(task: InternalTask): ScoreBreakdownItem[] {
  const items: ScoreBreakdownItem[] = ALL_NODES.filter((node) => node !== 'criteria.items').map((node) => {
    const field = task.fields.get(node);
    const confirmed = field?.state === 'confirmed';
    const earned =
      confirmed && (!field?.notApplicable || node === 'constraints.other')
        ? NODE_META[node].weight
        : 0;
    return {
      node,
      label: NODE_META[node].label,
      earned,
      max: NODE_META[node].weight,
      reason: confirmed ? 'подтверждено' : field?.state === 'suggested' ? 'ожидает подтверждения' : 'не заполнено',
    };
  });
  const criteriaEarned = Math.min(
    task.criteria
      .filter((criterion) => criterion.state === 'confirmed')
      .reduce((sum, criterion) => sum + (criterion.thresholdHasNumber ? 5 : 2), 0),
    NODE_META['criteria.items'].weight,
  );
  items.push({
    node: 'criteria.items',
    label: NODE_META['criteria.items'].label,
    earned: criteriaEarned,
    max: NODE_META['criteria.items'].weight,
    reason: `${task.criteria.filter((c) => c.state === 'confirmed').length}/3 критериев подтверждено`,
  });
  return items;
}

export function missingNodes(task: InternalTask): { node: NodeId; weight: number }[] {
  return ALL_NODES.filter((node) => {
    if (node === 'criteria.items') {
      return task.criteria.filter((c) => c.state === 'confirmed').length < 3;
    }
    const field = task.fields.get(node);
    return field?.state !== 'confirmed';
  }).map((node) => ({ node, weight: NODE_META[node].weight }));
}

export function nextStep(task: InternalTask): { node: NodeId; weight: number; consequence: string } | null {
  const missing = missingNodes(task).sort((a, b) => b.weight - a.weight);
  const top = missing[0];
  if (!top) return null;
  const score = calculateScore(task);
  const projected = Math.min(100, score + top.weight);
  return {
    node: top.node,
    weight: top.weight,
    consequence: `+${top.weight} → ${levelLabel(levelForScore(projected))}`,
  };
}

function levelLabel(level: ReadinessLevel): string {
  switch (level) {
    case 'draft':
      return 'Черновик';
    case 'working':
      return 'Рабочая';
    case 'ready':
      return 'Готовая';
    case 'priority':
      return 'Приоритетная';
  }
}
