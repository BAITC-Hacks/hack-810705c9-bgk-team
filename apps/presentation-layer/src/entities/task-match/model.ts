export const NODES = [
  { id: "context.current", block: "context", weight: 5, question: "Как процесс устроен сейчас?" },
  { id: "context.size", block: "context", weight: 5, question: "Насколько велика проблема?" },
  { id: "context.change", block: "context", weight: 10, question: "Что должно измениться?" },
  { id: "data.what", block: "data", weight: 10, question: "Какие данные, API или документация доступны?" },
  { id: "data.volume", block: "data", weight: 5, question: "Каков объём данных и за какой период?" },
  { id: "data.sample", block: "data", weight: 5, question: "Есть пример данных, схема или ссылка на документацию?" },
  { id: "result.artifact", block: "result", weight: 10, question: "Что именно команда должна сдать?" },
  { id: "result.acceptance", block: "result", weight: 5, question: "В каком виде примете результат?" },
  { id: "criteria.items", block: "criteria", weight: 15, question: "По каким трём критериям примете работу?" },
  { id: "constraints.deadline", block: "constraints", weight: 4, question: "К какому сроку нужен результат?" },
  { id: "constraints.stack", block: "constraints", weight: 3, question: "Какие технологии и роли нужны?" },
  { id: "constraints.other", block: "constraints", weight: 3, question: "Есть другие ограничения?" },
  { id: "users.role", block: "users", weight: 5, question: "Кто будет пользоваться решением?" },
  { id: "users.scale", block: "users", weight: 5, question: "Сколько пользователей и в каких ситуациях?" },
  { id: "link.contact", block: "link", weight: 4, question: "Кому команда сможет писать?" },
  { id: "link.cadence", block: "link", weight: 3, question: "Как часто сможете консультировать команду?" },
  { id: "link.response", block: "link", weight: 3, question: "За сколько дней ответите на отклик?" },
] as const;

export type NodeKey = (typeof NODES)[number]["id"];
export type FieldState = "empty" | "suggested" | "confirmed";
export type Field = {
  value: string;
  state: FieldState;
  notApplicable?: boolean;
  source?: string;
  sourceQuote?: string;
  sourceTurnId?: string;
};
export type Card = {
  fields: Partial<Record<NodeKey, Field>>;
  neededRoles?: string[];
  neededSkills?: string[];
  engagement?: "paid" | "practice" | "both";
};

export const NODE_ORDER: NodeKey[] = [
  "context.current", "context.size", "context.change",
  "result.artifact", "result.acceptance", "criteria.items",
  "data.what", "data.volume", "data.sample",
  "constraints.stack", "constraints.deadline", "constraints.other",
  "users.role", "users.scale", "link.contact", "link.cadence", "link.response",
];

export function fallbackQuestion(nodeKey: NodeKey): string {
  return NODES.find((node) => node.id === nodeKey)?.question ?? "Что ещё важно знать команде?";
}

export function nextGrillNode(currentNode: NodeKey | null, fields: Card["fields"] = {}): NodeKey | null {
  const start = currentNode ? Math.max(0, NODE_ORDER.indexOf(currentNode) + 1) : 0;
  const noData = /^(нет|данных нет|не применимо)$/i.test(fields["data.what"]?.value.trim() ?? "");
  const eligible = (key: NodeKey) => fields[key]?.state !== "confirmed" &&
    !(noData && (key === "data.volume" || key === "data.sample"));
  return NODE_ORDER.slice(start).find(eligible) ?? NODE_ORDER.slice(0, start).find(eligible) ?? null;
}

const hasNumber = (value: string) => /\d/.test(value);
const hasPeriod = (value: string) => /\b(день|дня|дней|недел|месяц|месяц|месяцев|год|лет|квартал|сут)/i.test(value);
const hasUrl = (value: string) => /https?:\/\/\S+/i.test(value);
const isAbsent = (value: string) => /^(нет|не применимо|н\/п|данных нет)$/i.test(value.trim());

function points(key: NodeKey, field: Field, card: Card): number {
  const value = field.value.trim();
  if (field.state !== "confirmed" || !value || field.notApplicable ||
      (key !== "constraints.other" && isAbsent(value))) return 0;
  const weight = NODES.find((node) => node.id === key)!.weight;
  switch (key) {
    case "context.size":
    case "users.scale":
    case "link.response": return hasNumber(value) ? weight : 0;
    case "data.volume": return hasNumber(value) || hasPeriod(value) ? weight : 0;
    case "data.sample": return hasUrl(value) || value.split("\n").filter(Boolean).length >= 3 ? weight : 0;
    case "result.artifact": return /(бот|сервис|модел|макет|отч[её]т|сайт|приложени|дашборд|прототип)/i.test(value) && value.length > 12 ? weight : 0;
    case "criteria.items": {
      const items = value.split(/\n|;/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
      return items.reduce((sum, item) => sum + (hasNumber(item) ? 5 : 2), 0);
    }
    case "constraints.deadline": return hasNumber(value) || hasPeriod(value) ? weight : 0;
    case "constraints.stack": return card.neededRoles?.length && card.neededSkills?.length ? weight : 0;
    case "link.contact": return /\S+@\S+\.\S+|@[\w.]+|(?:telegram|телеграм|whatsapp|ватсап)/i.test(value) ? weight : 0;
    default: return weight;
  }
}

export function score(card: Card) {
  const lines = NODES.map((node) => {
    const field = card.fields[node.id];
    const earned = field ? points(node.id, field, card) : 0;
    return { node: node.id, points: earned, max: node.weight, reason: earned ? "Подтверждено" : field?.notApplicable || isAbsent(field?.value ?? "") ? "Не применимо" : field?.state === "suggested" ? "Ожидает подтверждения" : "Нужно уточнить" };
  });
  const total = lines.reduce((sum, line) => sum + line.points, 0);
  const level = total < 40 ? "draft" : total < 70 ? "working" : total < 90 ? "ready" : "priority";
  const missing = lines.filter((line) => line.points < line.max);
  const nextStep = [...missing].sort((a, b) => (b.max - b.points) - (a.max - a.points))[0]?.node ?? null;
  return { total, level, lines, missing, nextStep };
}

export function transitionField(field: Field | undefined, action: "suggest" | "confirm" | "edit", value?: string): Field {
  if (action === "confirm") {
    if (!field || field.state !== "suggested") throw new Error("Only a suggested field can be confirmed");
    return { ...field, state: "confirmed" };
  }
  return { ...field, value: value ?? field?.value ?? "", state: "suggested" };
}

export type TeamFit = { roles: string[]; skills: string[]; technologies: string[]; interests: string[] };
export type TaskFit = { neededRoles: string[]; neededSkills: string[]; topic: string };
export function fit(team: TeamFit, task: TaskFit) {
  const normalized = (items: string[]) => new Set(items.map((item) => item.trim().toLowerCase()));
  const roles = normalized(team.roles);
  const skills = normalized([...team.skills, ...team.technologies]);
  const share = (required: string[], have: Set<string>) => required.length ? required.filter((item) => have.has(item.toLowerCase())).length / required.length : 0;
  const value = 0.5 * share(task.neededRoles, roles) + 0.3 * share(task.neededSkills, skills) + 0.2 * Number(normalized(team.interests).has(task.topic.toLowerCase()));
  return { value, missing: task.neededSkills.filter((item) => !skills.has(item.toLowerCase())) };
}

export function buildKickoffPacket(card: Card) {
  const confirmed = (key: NodeKey) => card.fields[key]?.state === "confirmed" ? card.fields[key]?.value.trim() : undefined;
  return [
    confirmed("data.sample") && { label: "Материалы", value: confirmed("data.sample")! },
    confirmed("constraints.stack") && { label: "Стек и роли", value: confirmed("constraints.stack")! },
    confirmed("link.cadence") && { label: "Первая консультация", value: confirmed("link.cadence")! },
    confirmed("criteria.items") && { label: "Первый этап", value: confirmed("criteria.items")!.split(/\n|;/)[0].trim() },
    confirmed("constraints.deadline") && { label: "Срок", value: confirmed("constraints.deadline")! },
    card.engagement && { label: "Формат", value: card.engagement === "paid" ? "Подработка: согласовать условия оплаты" : card.engagement === "practice" ? "Практика: этапы и отзыв идут в отчёт" : "Подработка или практика: согласовать формат" },
  ].filter((item): item is { label: string; value: string } => Boolean(item));
}
