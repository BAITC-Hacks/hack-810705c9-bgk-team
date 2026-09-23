import type { ApiTask, Criterion, Field } from '../contracts/common';
import type { ApiAiLogEntry } from '../contracts/ai-log';
import type { ApiProposal } from '../contracts/proposals';
import type { ApiStage } from '../contracts/stages';
import { notFound } from '../errors';
import type {
  InternalAiLog,
  InternalCriterion,
  InternalField,
  InternalGrillSession,
  InternalProposal,
  InternalStage,
  InternalSwipe,
  InternalTask,
  InternalTeam,
  InternalTurn,
} from './domain';
import { calculateScore, levelForScore } from './scoring';

/**
 * INTEGRATION(ADR-004/005/006/007): единственный in-memory store процесса
 * dev-сервера. Заменяется репозиториями поверх `db` (`src/shared/db/index.ts`,
 * Drizzle/`nextjs_db`) владельцами соответствующих ADR — use-case в
 * `src/features/*\/api` зависят только от функций этого модуля, поэтому
 * замену можно делать файл за файлом.
 */
class InMemoryStore {
  tasks = new Map<string, InternalTask>();
  sessions = new Map<string, InternalGrillSession>();
  turns = new Map<string, InternalTurn[]>();
  teams = new Map<string, InternalTeam>();
  proposals = new Map<string, InternalProposal>();
  stages = new Map<string, InternalStage>();
  swipes: InternalSwipe[] = [];
  aiLogs: InternalAiLog[] = [];
}

// Держим store на globalThis, чтобы Next.js dev (HMR/fast refresh) не терял
// данные между перекомпиляциями модуля.
const globalForStore = globalThis as unknown as { __taskMatchStore?: InMemoryStore };
export const store = globalForStore.__taskMatchStore ?? new InMemoryStore();
globalForStore.__taskMatchStore = store;

function seedTeams() {
  if (store.teams.size > 0) return;
  const seeds: InternalTeam[] = [
    {
      id: 'team-botforge',
      name: 'BotForge',
      roles: ['разработчик', 'ML'],
      skills: ['python', 'nlp'],
      technologies: ['fastapi', 'postgres'],
      interests: ['логистика', 'производство'],
      looksFor: 'both',
    },
    {
      id: 'team-databrew',
      name: 'DataBrew',
      roles: ['аналитик', 'ML'],
      skills: ['sql', 'аналитика данных'],
      technologies: ['python', 'airflow'],
      interests: ['ритейл', 'e-commerce'],
      looksFor: 'practice',
    },
    {
      id: 'team-pixelux',
      name: 'PixelUX',
      roles: ['дизайнер'],
      skills: ['ui', 'ux-исследования'],
      technologies: ['figma'],
      interests: ['образование'],
      looksFor: 'practice',
    },
    {
      id: 'team-webcraft',
      name: 'WebCraft',
      roles: ['разработчик'],
      skills: ['react', 'typescript'],
      technologies: ['next.js'],
      interests: ['e-commerce', 'ритейл'],
      looksFor: 'paid',
    },
    {
      id: 'team-qastra',
      name: 'QAstra',
      roles: ['QA'],
      skills: ['тестирование'],
      technologies: ['playwright'],
      interests: ['производство'],
      looksFor: 'both',
    },
  ];
  for (const team of seeds) store.teams.set(team.id, team);
}
seedTeams();

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function toApiField(field: InternalField): Field {
  return { ...field };
}

export function toApiCriterion(criterion: InternalCriterion): Criterion {
  return { ...criterion };
}

export function toApiTask(task: InternalTask): ApiTask {
  const score = calculateScore(task);
  return {
    id: task.id,
    businessId: task.businessId,
    title: task.title,
    topic: task.topic,
    draftText: task.draftText,
    status: task.status,
    format: task.format,
    paymentTerms: task.paymentTerms,
    neededRoles: task.neededRoles,
    neededSkills: task.neededSkills,
    tagsState: task.tagsState,
    score,
    level: levelForScore(score),
    fields: [...task.fields.values()].map(toApiField),
    criteria: task.criteria.map(toApiCriterion),
    criteriaVersion: task.criteriaVersion,
    createdAt: task.createdAt,
    publishedAt: task.publishedAt,
  };
}

export function toApiProposal(proposal: InternalProposal): ApiProposal {
  return {
    id: proposal.id,
    taskId: proposal.taskId,
    teamId: proposal.teamId,
    solution: proposal.solution,
    plan: proposal.plan,
    teamRoles: proposal.teamRoles,
    deadline: proposal.deadline,
    repoUrl: proposal.repoUrl,
    criteriaAnswers: proposal.criteriaAnswers,
    fit: proposal.fit,
    status: proposal.status,
    rejectReason: proposal.rejectReason,
    rejectNote: proposal.rejectNote,
    decidedAt: proposal.decidedAt,
    partialMatch: proposal.fit < 0.5,
  };
}

export function toApiStage(stage: InternalStage): ApiStage {
  return { ...stage };
}

export function toApiAiLog(entry: InternalAiLog): ApiAiLogEntry {
  return { ...entry };
}

/**
 * AI-14/ADR-003 §8: BFF пишет AiLog при каждом вызове AI-порта (успешном или
 * нет). Здесь — минимальная запись; полный набор полей (`prompt`,
 * `raw_output`, `retry_count`, `dropped[]`) заполняет владелец ADR-003 при
 * подключении реального порта.
 */
export function logAiCall(entry: Omit<InternalAiLog, 'id' | 'createdAt'>) {
  store.aiLogs.push({ ...entry, id: createId('ai-log'), createdAt: new Date().toISOString() });
}

export function getTaskOrThrow(taskId: string): InternalTask {
  const task = store.tasks.get(taskId);
  if (!task) {
    throw notFound('Задача не найдена.');
  }
  return task;
}
