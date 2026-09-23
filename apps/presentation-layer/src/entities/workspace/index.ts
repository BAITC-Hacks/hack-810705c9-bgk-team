export { getDemoData } from "./demo-data";
export { getWorkspaceTasks, workspaceIdentity } from "./task-scope";
export {
  TASK_FIELDS,
  calculateScore,
  confirmMilestone,
  createTask,
  getTaskSummary,
  readiness,
  scoreBreakdown,
  suggestQuestions,
  submitMilestone,
} from "./model";
export type {
  Message,
  MilestoneSubmission,
  Proposal,
  Role,
  Task,
  TaskField,
  Team,
  WorkspaceData,
} from "./model";
