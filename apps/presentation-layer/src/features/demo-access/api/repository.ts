// ЗАГЛУШКА ADR-008. Порт хранилища и in-memory данные для проверки доступа
// до слияния с ADR-003 (AiLog) и ADR-007 (Proposal, Stage).
//
// ИНТЕГРАЦИЯ: владельцы ADR-003/007 реализуют `DemoAccessRepository` поверх
// Drizzle (`nextjs_db`) и передают его в use-case; `createStubRepository` и
// `demoAccessRepository` удаляются. Проверки доступа в use-case не меняются.

import { DEMO_BUSINESSES, DEMO_TEAMS } from "@/shared/config/demo-actors";

export type ProposalStatus = "submitted" | "on_hold" | "accepted" | "rejected";
export type StageStatus = "open" | "claimed" | "confirmed" | "returned";

export type TaskRecord = { id: string; businessId: string; title: string };
export type ProposalRecord = {
  id: string;
  taskId: string;
  teamId: string;
  status: ProposalStatus;
  rejectReason: string | null;
};
export type StageRecord = {
  id: string;
  proposalId: string;
  status: StageStatus;
  reportUrl: string | null;
};
/** Состав записи по AI-14 / ADR-003. */
export type AiLogEntry = {
  id: string;
  taskId: string;
  kind: string;
  prompt: string;
  input: unknown;
  rawOutput: string;
  parseOk: boolean;
  droppedFields: string[];
  fallbackUsed: boolean;
};

export interface DemoAccessRepository {
  findTask(id: string): Promise<TaskRecord | null>;
  findProposal(id: string): Promise<ProposalRecord | null>;
  findStage(id: string): Promise<StageRecord | null>;
  listAiLog(taskId: string): Promise<AiLogEntry[]>;
  saveProposal(proposal: ProposalRecord): Promise<ProposalRecord>;
  saveStage(stage: StageRecord): Promise<StageRecord>;
}

const [bizLogistics, bizFactory] = DEMO_BUSINESSES;
const [botForge, dataBrew, pixelUx] = DEMO_TEAMS;

/** Стабильные id для curl-проверок из ADR-008. */
export const STUB_IDS = {
  task: "demo-task-delivery-bot",
  otherTask: "demo-task-factory",
  proposalBotForge: "demo-proposal-botforge",
  proposalDataBrew: "demo-proposal-databrew",
  proposalPixelUx: "demo-proposal-pixelux",
  stageBotForge: "demo-stage-botforge",
  stageDataBrew: "demo-stage-databrew",
} as const;

type StubData = {
  tasks: TaskRecord[];
  proposals: ProposalRecord[];
  stages: StageRecord[];
  aiLog: AiLogEntry[];
};

function seed(): StubData {
  return {
    tasks: [
      { id: STUB_IDS.task, businessId: bizLogistics.id, title: "Бот статусов доставки" },
      { id: STUB_IDS.otherTask, businessId: bizFactory.id, title: "Учёт простоев станков" },
    ],
    proposals: [
      { id: STUB_IDS.proposalBotForge, taskId: STUB_IDS.task, teamId: botForge.id, status: "accepted", rejectReason: null },
      // T-18: бизнес выбрал две команды, у каждой свой этап.
      { id: STUB_IDS.proposalDataBrew, taskId: STUB_IDS.task, teamId: dataBrew.id, status: "accepted", rejectReason: null },
      { id: STUB_IDS.proposalPixelUx, taskId: STUB_IDS.task, teamId: pixelUx.id, status: "submitted", rejectReason: null },
    ],
    stages: [
      { id: STUB_IDS.stageBotForge, proposalId: STUB_IDS.proposalBotForge, status: "open", reportUrl: null },
      { id: STUB_IDS.stageDataBrew, proposalId: STUB_IDS.proposalDataBrew, status: "open", reportUrl: null },
    ],
    aiLog: [
      {
        id: "demo-ailog-1",
        taskId: STUB_IDS.task,
        kind: "card-extractor",
        prompt: "Разложи ответ бизнеса по узлам карточки с цитатой-источником.",
        input: { answer: "Клиенты звонят узнать статус, пишите на it@logistics.example" },
        rawOutput: '{"fields":[{"node":"need","value":"Клиенты звонят узнать статус"}]}',
        parseOk: true,
        droppedFields: ["users.scale"],
        fallbackUsed: false,
      },
    ],
  };
}

export function createStubRepository(): DemoAccessRepository {
  const data = seed();
  const byId = <T extends { id: string }>(rows: T[], id: string) =>
    structuredClone(rows.find((row) => row.id === id) ?? null);
  const upsert = <T extends { id: string }>(rows: T[], row: T) => {
    const index = rows.findIndex((item) => item.id === row.id);
    if (index === -1) rows.push(row);
    else rows[index] = row;
    return structuredClone(row);
  };
  return {
    findTask: async (id) => byId(data.tasks, id),
    findProposal: async (id) => byId(data.proposals, id),
    findStage: async (id) => byId(data.stages, id),
    listAiLog: async (taskId) =>
      structuredClone(data.aiLog.filter((entry) => entry.taskId === taskId)),
    saveProposal: async (proposal) => upsert(data.proposals, proposal),
    saveStage: async (stage) => upsert(data.stages, stage),
  };
}

/** Общий экземпляр для route handlers; живёт до перезапуска dev-сервера. */
export const demoAccessRepository = createStubRepository();
