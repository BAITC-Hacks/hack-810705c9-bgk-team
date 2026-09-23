// ADR-007, п.6: баллы и портфолио считаются, а не хранятся.
// team_points = SUM(stage.points) по подтверждённым этапам команды (FR-8.4, FR-8.5).

export type TeamStageRow = {
  stageId: string;
  status: string;
  points: number;
  taskId: string;
  taskTitle: string;
  metric: string;
  threshold: string;
  teamRoles: string[];
  businessComment: string | null;
  confirmedAt: Date | string | null;
};

export type PortfolioItem = {
  stageId: string;
  points: number;
  taskId: string;
  taskTitle: string;
  metric: string;
  threshold: string;
  teamRoles: string[];
  businessComment: string | null;
  confirmedAt: Date | string | null;
};

export type TeamProgress = {
  points: number;
  portfolio: PortfolioItem[];
};

function confirmedAtMs(value: Date | string | null): number {
  if (value === null) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function summarizeTeamProgress(rows: TeamStageRow[]): TeamProgress {
  const confirmed = rows.filter((row) => row.status === "confirmed");

  const points = confirmed.reduce((sum, row) => sum + row.points, 0);

  const portfolio: PortfolioItem[] = confirmed
    .slice()
    .sort((a, b) => confirmedAtMs(b.confirmedAt) - confirmedAtMs(a.confirmedAt))
    .map((row) => ({
      stageId: row.stageId,
      points: row.points,
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      metric: row.metric,
      threshold: row.threshold,
      teamRoles: row.teamRoles,
      businessComment: row.businessComment,
      confirmedAt: row.confirmedAt,
    }));

  return { points, portfolio };
}
