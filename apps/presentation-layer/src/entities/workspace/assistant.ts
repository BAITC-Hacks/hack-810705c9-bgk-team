import type { AssistantContext } from "@/shared/api/contracts/assistant";
import {
  calculateScore,
  getTaskSummary,
  readiness,
  scoreBreakdown,
  type Proposal,
  type Task,
  type Team,
} from "./model";

const PROPOSAL_STATUS_LABELS: Record<Proposal["status"], string> = {
  pending: "на рассмотрении",
  selected: "выбрана бизнесом",
  rejected: "отклонена бизнесом",
};

/**
 * Свежий снимок карточки для интерактивного чата менеджера:
 * сводка полей, балл, расшифровка и отклики именно этой задачи.
 * Чистая функция — данные только читает, никогда не меняет.
 */
export function buildAssistantContext(
  task: Task,
  proposals: Proposal[],
  teams: Team[],
): AssistantContext {
  const score = calculateScore(task);
  return {
    taskSummary: getTaskSummary(task),
    score,
    readinessLabel: readiness(score).label,
    breakdown: scoreBreakdown(task).map(({ label, earned, max }) => ({
      label,
      earned,
      max,
    })),
    proposals: proposals
      .filter(({ taskId }) => taskId === task.id)
      .map((proposal) => {
        const team = teams.find(({ id }) => id === proposal.teamId);
        return {
          teamName: team?.name ?? "Команда",
          statusLabel: PROPOSAL_STATUS_LABELS[proposal.status],
          idea: proposal.idea,
          plan: proposal.plan,
          timeline: proposal.timeline,
          skills: team?.skills ?? [],
        };
      }),
  };
}
