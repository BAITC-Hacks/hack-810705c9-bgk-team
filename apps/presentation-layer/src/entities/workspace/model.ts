import type { ChatAttachment } from "./chat-contracts";
export type Role = "business" | "student";

export type TaskField =
  | "context"
  | "need"
  | "users"
  | "data"
  | "constraints"
  | "outcome"
  | "success"
  | "contact"
  | "interaction";

export type Task = {
  id: string;
  title: string;
  company: string;
  industry: string;
  description: string;
  fields: Record<TaskField, string>;
  confirmedFields: TaskField[];
  status: "draft" | "published";
  createdAt: string;
  score?: number;
  canEdit?: boolean;
  publishedAt?: string | null;
  version?: number;
};

export type Team = {
  id: string;
  name: string;
  initials: string;
  tagline: string;
  skills: string[];
  interests: string[];
  members: number;
  color: string;
};

export type MilestoneSubmission = {
  title: string;
  resultUrl: string;
  comment: string;
};

export type Proposal = {
  id: string;
  taskId: string;
  teamId: string;
  idea: string;
  plan: string;
  timeline: string;
  prototypeUrl: string;
  status: "pending" | "selected" | "rejected";
  milestoneConfirmed: boolean;
  points?: number;
  milestone?: MilestoneSubmission;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

export type WorkspaceData = {
  tasks: Task[];
  teams: Team[];
  proposals: Proposal[];
};

export const TASK_FIELDS: {
  key: TaskField;
  label: string;
  placeholder: string;
  question: string;
  weight: number;
}[] = [
  {
    key: "context",
    label: "Контекст бизнеса",
    placeholder: "Чем занимается компания и как процесс устроен сейчас?",
    question:
      "Как сейчас устроен этот процесс и сколько людей в нём участвует?",
    weight: 10,
  },
  {
    key: "need",
    label: "Проблема",
    placeholder: "Что не получается и почему это важно исправить?",
    question:
      "В какой момент возникает проблема и к каким потерям она приводит?",
    weight: 10,
  },
  {
    key: "users",
    label: "Пользователи",
    placeholder: "Кто будет пользоваться решением?",
    question:
      "Кто будет пользоваться решением каждый день и что ему нужно уметь делать?",
    weight: 10,
  },
  {
    key: "data",
    label: "Данные и материалы",
    placeholder: "Какие таблицы, примеры или документы доступны команде?",
    question:
      "Какие данные вы готовы передать команде: в каком формате и за какой период?",
    weight: 20,
  },
  {
    key: "constraints",
    label: "Ограничения",
    placeholder: "Срок, бюджет, технологии и обязательные условия",
    question: "Какие сроки и ограничения команда должна учитывать?",
    weight: 10,
  },
  {
    key: "outcome",
    label: "Ожидаемый результат",
    placeholder: "Что команда должна показать или передать в конце?",
    question: "Какой конкретный результат вы хотите получить от команды?",
    weight: 15,
  },
  {
    key: "success",
    label: "Критерий успеха",
    placeholder: "По какой метрике вы поймёте, что решение помогло?",
    question:
      "С каким текущим показателем сравним результат и какое улучшение будет успехом?",
    weight: 15,
  },
  {
    key: "contact",
    label: "Контакт со стороны бизнеса",
    placeholder: "Кто отвечает за задачу и принимает результат?",
    question:
      "Кто со стороны бизнеса сможет отвечать на вопросы и принимать результат?",
    weight: 5,
  },
  {
    key: "interaction",
    label: "Формат взаимодействия",
    placeholder: "Как часто сможете давать обратную связь?",
    question:
      "Как часто вам удобно встречаться с командой и давать обратную связь?",
    weight: 5,
  },
];

function isConfirmed(task: Task, field: TaskField): boolean {
  return (
    task.confirmedFields.includes(field) && task.fields[field].trim().length > 0
  );
}

export function calculateScore(task: Task): number {
  if (typeof task.score === "number") return task.score;
  return TASK_FIELDS.reduce(
    (score, field) => score + (isConfirmed(task, field.key) ? field.weight : 0),
    0,
  );
}

const SCORE_GROUPS: { label: string; fields: TaskField[] }[] = [
  { label: "Контекст и потребность", fields: ["context", "need"] },
  { label: "Данные и материалы", fields: ["data"] },
  { label: "Ожидаемый результат", fields: ["outcome"] },
  { label: "Критерии успеха", fields: ["success"] },
  { label: "Ограничения", fields: ["constraints"] },
  { label: "Пользователи", fields: ["users"] },
  { label: "Связь с бизнесом", fields: ["contact", "interaction"] },
];

export function scoreBreakdown(task: Task): {
  label: string;
  earned: number;
  max: number;
  missing: TaskField[];
}[] {
  return SCORE_GROUPS.map((group) => {
    const fields = TASK_FIELDS.filter((field) =>
      group.fields.includes(field.key),
    );
    return {
      label: group.label,
      earned: fields.reduce(
        (sum, field) => sum + (isConfirmed(task, field.key) ? field.weight : 0),
        0,
      ),
      max: fields.reduce((sum, field) => sum + field.weight, 0),
      missing: fields
        .filter((field) => !isConfirmed(task, field.key))
        .map((field) => field.key),
    };
  });
}

export function readiness(score: number): {
  label: string;
  tone: "muted" | "amber" | "green" | "violet";
} {
  if (score < 40) return { label: "Требует уточнения", tone: "muted" };
  if (score < 70) return { label: "Рабочая", tone: "amber" };
  if (score < 90) return { label: "Готовая", tone: "green" };
  return { label: "Приоритетная", tone: "violet" };
}

export function createTask(description: string): Task {
  const text = description.trim();
  const title = text.split(/[\n.!?]/, 1)[0].trim();
  return {
    id: crypto.randomUUID(),
    title: title
      ? title.length > 68
        ? `${title.slice(0, 65)}…`
        : title
      : "Новая задача",
    company: "Моя компания",
    industry: "Другое",
    description: text,
    fields: {
      context: "",
      need: text,
      users: "",
      data: "",
      constraints: "",
      outcome: "",
      success: "",
      contact: "",
      interaction: "",
    },
    confirmedFields: [],
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}

export function suggestQuestions(
  task: Task,
): { field: TaskField; question: string }[] {
  // Filled answers need human confirmation, not the same question again.
  return TASK_FIELDS.filter((field) => !task.fields[field.key].trim())
    .sort((first, second) => second.weight - first.weight)
    .slice(0, 3)
    .map((field) => ({ field: field.key, question: field.question }));
}

export function submitMilestone(
  proposal: Proposal,
  submission: MilestoneSubmission,
): Proposal {
  if (proposal.status !== "selected" || proposal.milestoneConfirmed) return proposal;
  const milestone = {
    title: submission.title.trim(),
    resultUrl: submission.resultUrl.trim(),
    comment: submission.comment.trim(),
  };
  if (!milestone.title || !milestone.comment) return proposal;
  try {
    const url = new URL(milestone.resultUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return proposal;
  } catch {
    return proposal;
  }
  return { ...proposal, milestone };
}

export function confirmMilestone(proposal: Proposal): Proposal {
  if (proposal.status !== "selected" || !proposal.milestone || proposal.milestoneConfirmed) {
    return proposal;
  }
  return { ...proposal, milestoneConfirmed: true };
}

export function getTaskSummary(task: Task): string {
  return [
    task.title,
    `${task.company} · ${task.industry}`,
    "",
    ...TASK_FIELDS.map((field) => {
      const value = task.fields[field.key].trim();
      if (!value) return `${field.label}: нужно уточнить`;
      return `${field.label}: ${value}${isConfirmed(task, field.key) ? "" : " (нужно подтвердить)"}`;
    }),
  ].join("\n");
}
