import type {
  BlockId,
  FieldState,
  NodeId,
  ProposalStatus,
  StageStatus,
  StoredRejectReason,
  TaskStatus,
  WorkFormat,
} from '../contracts/common';

/**
 * INTEGRATION(ADR-004/005/006/007): внутренние типы in-memory хранилища.
 * Схема нарочно упрощена относительно таблиц из ADR-004/007
 * (`grill_session`, `grill_turn`, `task_field`, `criterion`, `proposal`,
 * `stage`) — задача этого модуля только продемонстрировать контракт API
 * (ADR-009), не саму бизнес-модель. Владельцы соответствующих ADR заменяют
 * репозитории на Drizzle-запросы к `nextjs_db`, не меняя сигнатуры
 * use-case.
 */

export type InternalField = {
  node: NodeId;
  value: string;
  state: FieldState;
  notApplicable: boolean;
  naNote?: string;
  source: 'draft' | 'turn' | 'manual';
  sourceQuote?: string;
  sourceTurnId?: string;
};

export type InternalCriterion = {
  id: string;
  position: 1 | 2 | 3;
  metric: string;
  threshold: string;
  thresholdHasNumber: boolean;
  howToCheck: string;
  state: FieldState;
};

export type InternalTask = {
  id: string;
  businessId: string;
  title: string;
  topic: string;
  draftText: string;
  status: TaskStatus;
  format: WorkFormat;
  paymentTerms?: string;
  neededRoles: string[];
  neededSkills: string[];
  tagsState: FieldState;
  fields: Map<NodeId, InternalField>;
  criteria: InternalCriterion[];
  criteriaVersion: number;
  createdAt: string;
  publishedAt?: string;
};

export type InternalGrillSession = {
  taskId: string;
  status: 'active' | 'finished';
  currentNode: NodeId | null;
  currentBlock: BlockId;
  pushbacks: Partial<Record<NodeId, 0 | 1>>;
  questionsAsked: number;
  version: number;
  dataNoneBranch: boolean;
};

export type InternalTurn = {
  id: string;
  sessionTaskId: string;
  seq: number;
  node: NodeId;
  question: string;
  options: string[];
  isPushback: boolean;
  answer?: string;
  fallbackUsed: boolean;
};

export type InternalTeam = {
  id: string;
  name: string;
  roles: string[];
  skills: string[];
  technologies: string[];
  interests: string[];
  looksFor: WorkFormat;
};

export type InternalProposal = {
  id: string;
  taskId: string;
  teamId: string;
  solution: string;
  plan: string;
  teamRoles: string[];
  deadline: string;
  repoUrl?: string;
  criteriaAnswers: { criterionId: string; howWeWillCheck: string }[];
  fit: number;
  status: ProposalStatus;
  rejectReason?: StoredRejectReason;
  rejectNote?: string;
  decidedAt?: string;
  kickoff?: {
    materials: string[];
    stack: string[];
    consultations?: string;
    deadline: string;
    paymentOrPracticeNote: string;
    firstStage: { criterionId: string; metric: string; howToCheck: string } | null;
  };
};

export type InternalStage = {
  id: string;
  proposalId: string;
  criterionId: string;
  criteriaVersion: number;
  metric: string;
  threshold: string;
  howToCheck: string;
  status: StageStatus;
  reportUrl?: string;
  teamComment?: string;
  businessComment?: string;
  points: number;
  confirmedAt?: string;
};

export type InternalSwipe = {
  teamId: string;
  taskId: string;
  action: 'skip' | 'missing';
  block?: BlockId;
  note?: string;
  at: string;
};

export type InternalAiLog = {
  id: string;
  taskId: string;
  turnId?: string;
  kind: 'analyze-text' | 'phrase-question';
  agent: string;
  model: string;
  prompt: string;
  input: string;
  rawOutput: string;
  parseOk: boolean;
  retryCount: number;
  dropped: string[];
  latencyMs: number;
  error?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  createdAt: string;
};
