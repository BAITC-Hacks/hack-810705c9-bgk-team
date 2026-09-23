export { computeFit } from "./model/fit";
export type { FitTask, FitTeam } from "./model/fit";

export { PARTIAL_MATCH_THRESHOLD, compareProposals } from "./model/compare";
export type { CompareCriterion, CompareMatrix, CompareResult, ComparedProposal, ProposalLike } from "./model/compare";

export {
  ACTIVE_PROPOSAL_STATUSES,
  DECIDABLE_STATUSES,
  EDITABLE_PROPOSAL_STATUSES,
  STAGE_CLAIMABLE,
  STAGE_POINTS,
  TASK_STATUSES_ACCEPTING_PROPOSALS,
  TASK_STATUSES_ALLOWING_ACCEPT,
  canDecide,
} from "./model/transitions";
