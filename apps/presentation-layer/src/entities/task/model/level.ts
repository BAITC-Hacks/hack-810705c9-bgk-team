export type Level = "draft" | "working" | "ready" | "priority";

export const LEVEL_LABELS: Record<Level, string> = {
  draft: "Черновик",
  working: "Рабочая",
  ready: "Готовая",
  priority: "Приоритетная",
};

// Раздел 6.2: 0–39 / 40–69 / 70–89 / 90–100.
const LEVEL_RANGES: Record<Level, { min: number; max: number }> = {
  draft: { min: 0, max: 39 },
  working: { min: 40, max: 69 },
  ready: { min: 70, max: 89 },
  priority: { min: 90, max: 100 },
};

export function levelOf(score: number): Level {
  if (score >= 90) return "priority";
  if (score >= 70) return "ready";
  if (score >= 40) return "working";
  return "draft";
}

export function levelRange(level: Level): { min: number; max: number } {
  return { ...LEVEL_RANGES[level] };
}

/** Метки каталога FR-4.6. */
export function catalogBadge(score: number): string | null {
  const level = levelOf(score);
  if (level === 'draft') return 'Требует уточнения';
  if (level === 'priority') return 'Полностью готова';
  return null;
}
