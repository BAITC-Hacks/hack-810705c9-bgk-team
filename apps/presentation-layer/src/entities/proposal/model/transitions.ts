// Чистые правила переходов состояний (ADR-007, раздел «Решение»).
// Use-case'ы опираются на них для условных UPDATE и текстов ошибок; сама БД
// проверяет переходы условным WHERE, здесь — только читаемые константы и предикаты.

export const DECIDABLE_STATUSES = ["submitted", "on_hold"] as const;
export const EDITABLE_PROPOSAL_STATUSES = ["submitted", "on_hold"] as const;
export const ACTIVE_PROPOSAL_STATUSES = ["submitted", "on_hold", "accepted"] as const;
export const STAGE_CLAIMABLE = ["open", "returned"] as const;
export const STAGE_POINTS = 10;
export const TASK_STATUSES_ACCEPTING_PROPOSALS = ["published", "in_work"] as const;
export const TASK_STATUSES_ALLOWING_ACCEPT = ["published", "in_work"] as const;

export function canDecide(status: string): boolean {
  return (DECIDABLE_STATUSES as readonly string[]).includes(status);
}
