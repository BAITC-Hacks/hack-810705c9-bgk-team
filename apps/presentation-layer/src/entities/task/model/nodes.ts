export const SCORE_NODES = [
  "context.current",
  "context.size",
  "context.change",
  "data.what",
  "data.volume",
  "data.sample",
  "result.artifact",
  "result.acceptance",
  "criteria.items",
  "constraints.deadline",
  "constraints.stack",
  "constraints.other",
  "users.role",
  "users.scale",
  "link.contact",
  "link.cadence",
  "link.response",
] as const;

export type ScoreNode = (typeof SCORE_NODES)[number];

export type ScoreBlock =
  "context" | "data" | "result" | "criteria" | "constraints" | "users" | "link";

export type FieldState = "empty" | "suggested" | "confirmed";

type NodeMeta = {
  block: ScoreBlock;
  label: string;
  question: string;
  max: number;
};

// Таблица 6.1 спецификации: сумма max = 100.
export const NODE_META: Record<ScoreNode, NodeMeta> = {
  "context.current": {
    block: "context",
    label: "Как сейчас",
    question: "Как процесс устроен сейчас?",
    max: 5,
  },
  "context.size": {
    block: "context",
    label: "Масштаб проблемы",
    question: "Насколько велика проблема?",
    max: 5,
  },
  "context.change": {
    block: "context",
    label: "Что изменить",
    question: "Что должно измениться?",
    max: 10,
  },
  "data.what": {
    block: "data",
    label: "Данные и материалы",
    question: "Какие данные, API, документация?",
    max: 10,
  },
  "data.volume": {
    block: "data",
    label: "Объём данных",
    question: "Объём, период?",
    max: 5,
  },
  "data.sample": {
    block: "data",
    label: "Пример данных",
    question: "Пример, схема, Swagger?",
    max: 5,
  },
  "result.artifact": {
    block: "result",
    label: "Что сдаём",
    question: "Что сдаём?",
    max: 10,
  },
  "result.acceptance": {
    block: "result",
    label: "Как сдаём",
    question: "Как сдаём: демо, репозиторий, документация?",
    max: 5,
  },
  "criteria.items": {
    block: "criteria",
    label: "Критерии успеха",
    question: "По каким метрикам примете?",
    max: 15,
  },
  "constraints.deadline": {
    block: "constraints",
    label: "Срок",
    question: "Срок?",
    max: 4,
  },
  "constraints.stack": {
    block: "constraints",
    label: "Стек и роли",
    question: "Стек, роли?",
    max: 3,
  },
  "constraints.other": {
    block: "constraints",
    label: "Иные ограничения",
    question: "Иные границы: что нельзя, конфиденциальность?",
    max: 3,
  },
  "users.role": {
    block: "users",
    label: "Пользователи",
    question: "Кто пользователь?",
    max: 5,
  },
  "users.scale": {
    block: "users",
    label: "Сколько пользователей",
    question: "Сколько их, в какой ситуации?",
    max: 5,
  },
  "link.contact": {
    block: "link",
    label: "Контакт",
    question: "Кому писать?",
    max: 4,
  },
  "link.cadence": {
    block: "link",
    label: "Консультации",
    question: "Формат консультаций?",
    max: 3,
  },
  "link.response": {
    block: "link",
    label: "Ответ на отклики",
    question: "Порядок обратной связи: когда ответите на отклики?",
    max: 3,
  },
};
