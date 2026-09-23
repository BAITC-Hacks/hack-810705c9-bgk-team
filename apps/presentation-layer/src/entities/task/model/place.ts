export type RankedTask = {
  id: string;
  score: number;
  publishedAt: Date | null;
};

// FR-4.4 и ADR-005: score DESC, при равенстве раньше опубликованная выше, затем id.
// Для неопубликованной задачи — гипотетическое место, если опубликовать сейчас.
export function catalogPlace(
  task: RankedTask,
  published: RankedTask[],
): number {
  const others = published.filter((other) => other.id !== task.id);

  if (task.publishedAt === null)
    return 1 + others.filter((other) => other.score >= task.score).length;

  const taskTime = task.publishedAt.getTime();
  const ahead = others.filter((other) => {
    if (other.score !== task.score) return other.score > task.score;
    if (other.publishedAt === null) return false;
    const otherTime = other.publishedAt.getTime();
    if (otherTime !== taskTime) return otherTime < taskTime;
    return other.id < task.id;
  });
  return 1 + ahead.length;
}
