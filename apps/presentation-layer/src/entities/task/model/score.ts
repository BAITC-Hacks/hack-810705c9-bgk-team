import { levelOf, type Level } from "./level";
import {
  NODE_META,
  SCORE_NODES,
  type FieldState,
  type ScoreNode,
} from "./nodes";

type FieldNode = Exclude<ScoreNode, "criteria.items" | "constraints.stack">;

export type ScoreFieldInput = {
  value: string;
  state: FieldState;
  notApplicable: boolean;
};

export type ScoreCriterionInput = {
  position: number;
  metric: string;
  threshold: string;
  thresholdHasNumber?: boolean;
  state: FieldState;
};

// Раздел 6.3: на вход только узлы карточки — без формата, оплаты, свайпов и откликов.
export type ScoreCard = {
  fields: Partial<Record<FieldNode, ScoreFieldInput>>;
  criteria: ScoreCriterionInput[];
  tags: { state: "suggested" | "confirmed"; roles: string[]; skills: string[] };
};

export type ScoreLine = {
  node: ScoreNode;
  points: number;
  max: number;
  reason: string;
};

export type ScoreResult = {
  total: number;
  lines: ScoreLine[];
  missing: { node: ScoreNode; weight: number }[];
  nextStep: { node: ScoreNode; gain: number; levelAfter: Level } | null;
};

const MAX_CRITERIA = 3;
const CRITERION_WITH_NUMBER = 5;
const CRITERION_WITHOUT_NUMBER = 2;

const HAS_NUMBER = /\d/;
const PERIOD_WORD =
  /(?<!\p{L})(день|дн|сут|недел|месяц|мес|квартал|полугод|год|лет)/iu;
const DATE_WORD =
  /(?<!\p{L})(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|сегодня|завтра|семестр)/iu;
const URL = /https?:\/\/\S+/i;
const TABLE_ROW = /[|;,\t]/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MESSENGER =
  /((?<![\w.])@[a-z0-9_]{3,}|t\.me\/|wa\.me\/|telegram|телеграм|whatsapp|ватсап|вотсап)/i;
const PHONE = /\+7[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/;
const RESPONSE_DAYS =
  /\d+\s*(рабоч\p{L}*\s+|календарн\p{L}*\s+)?(день|дня|дней|дн|сут|рабоч)/iu;

export const ARTIFACT_TYPE_PATTERN =
  /(?<!\p{L})(чат-?бот|бот|модел|макет|прототип|дашборд|сервис|приложени|сайт|лендинг|скрипт|api|отч[её]т|парсер|интеграци|виджет|плагин|mvp)/iu;

type Check = { ok: boolean; fail: string };

type FieldRule = (value: string) => Check;

const confirmedOnly: FieldRule = () => ({ ok: true, fail: "" });

function hasNumber(value: string): Check {
  return { ok: HAS_NUMBER.test(value), fail: "нет числа" };
}

function hasNumberOrPeriod(value: string): Check {
  return {
    ok: HAS_NUMBER.test(value) || PERIOD_WORD.test(value),
    fail: "нет числа или периода",
  };
}

function isSample(value: string): Check {
  const rows = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && TABLE_ROW.test(line));
  return {
    ok: URL.test(value) || rows.length >= 3,
    fail: "нужен URL или ≥3 строк таблицы",
  };
}

function isArtifact(value: string): Check {
  const words = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const typed = words.some((word) => ARTIFACT_TYPE_PATTERN.test(word));
  const described = words.some(
    (word) => !ARTIFACT_TYPE_PATTERN.test(word) && word.toLowerCase() !== "чат",
  );
  return { ok: typed && described, fail: "нужны тип и описание" };
}

function isDeadline(value: string): Check {
  return {
    ok:
      HAS_NUMBER.test(value) ||
      PERIOD_WORD.test(value) ||
      DATE_WORD.test(value),
    fail: "нет даты или срока",
  };
}

function isContact(value: string): Check {
  return {
    ok: EMAIL.test(value) || MESSENGER.test(value) || PHONE.test(value),
    fail: "нужен email или мессенджер",
  };
}

function hasResponseDays(value: string): Check {
  return { ok: RESPONSE_DAYS.test(value), fail: "нет числа дней" };
}

const FIELD_RULES: Record<FieldNode, FieldRule> = {
  "context.current": confirmedOnly,
  "context.size": hasNumber,
  "context.change": confirmedOnly,
  "data.what": confirmedOnly,
  "data.volume": hasNumberOrPeriod,
  "data.sample": isSample,
  "result.artifact": isArtifact,
  "result.acceptance": confirmedOnly,
  "constraints.deadline": isDeadline,
  "constraints.other": confirmedOnly,
  "users.role": confirmedOnly,
  "users.scale": confirmedOnly,
  "link.contact": isContact,
  "link.cadence": confirmedOnly,
  "link.response": hasResponseDays,
};

function isConfirmedNotApplicable(field: ScoreFieldInput | undefined): boolean {
  return field?.state === "confirmed" && field.notApplicable;
}

function scoreField(node: FieldNode, card: ScoreCard): ScoreLine {
  const max = NODE_META[node].max;
  const field = card.fields[node];
  const line = (points: number, reason: string): ScoreLine => ({
    node,
    points,
    max,
    reason,
  });

  if (!field || field.state === "empty") return line(0, "нет ответа");
  if (field.state !== "confirmed") return line(0, "не подтверждено");
  if (field.notApplicable)
    return node === "constraints.other"
      ? line(max, "ограничений нет — засчитано")
      : line(0, "не применимо");

  const value = field.value.trim();
  if (value.length === 0) return line(0, "пустой ответ");

  const check = FIELD_RULES[node](value);
  return check.ok ? line(max, "подтверждено") : line(0, check.fail);
}

function scoreCriteria(card: ScoreCard): ScoreLine {
  const max = NODE_META["criteria.items"].max;
  const counted = card.criteria
    .filter(
      (criterion) =>
        criterion.state === "confirmed" &&
        criterion.metric.trim().length > 0 &&
        criterion.threshold.trim().length > 0,
    )
    .sort((left, right) => left.position - right.position)
    .slice(0, MAX_CRITERIA);

  if (counted.length === 0)
    return {
      node: "criteria.items",
      points: 0,
      max,
      reason: "нет подтверждённых критериев с метрикой и порогом",
    };

  const withNumber = counted.filter(
    (criterion) =>
      criterion.thresholdHasNumber ?? HAS_NUMBER.test(criterion.threshold),
  ).length;
  const points =
    withNumber * CRITERION_WITH_NUMBER +
    (counted.length - withNumber) * CRITERION_WITHOUT_NUMBER;

  return {
    node: "criteria.items",
    points,
    max,
    reason: `${withNumber} из ${MAX_CRITERIA} критериев с числом, ${counted.length - withNumber} без числа`,
  };
}

function scoreStack(card: ScoreCard): ScoreLine {
  const max = NODE_META["constraints.stack"].max;
  const { state, roles, skills } = card.tags;
  const line = (points: number, reason: string): ScoreLine => ({
    node: "constraints.stack",
    points,
    max,
    reason,
  });

  if (roles.length === 0 || skills.length === 0)
    return line(0, "нужны роли и навыки");
  if (state !== "confirmed") return line(0, "не подтверждено");
  return line(max, "роли и навыки подтверждены");
}

function isSkippedAnswer(node: ScoreNode, card: ScoreCard): boolean {
  if (node === "criteria.items" || node === "constraints.stack") return false;
  if (isConfirmedNotApplicable(card.fields[node])) return true;
  // FR-1.8: «данных нет» — узлы объёма и примера не спрашиваются.
  return (
    (node === "data.volume" || node === "data.sample") &&
    isConfirmedNotApplicable(card.fields["data.what"])
  );
}

export function score(card: ScoreCard): ScoreResult {
  const lines = SCORE_NODES.map((node) => {
    if (node === "criteria.items") return scoreCriteria(card);
    if (node === "constraints.stack") return scoreStack(card);
    return scoreField(node, card);
  });
  const total = lines.reduce((sum, line) => sum + line.points, 0);

  const missing = lines
    .filter((line) => line.points < line.max)
    .filter((line) => !isSkippedAnswer(line.node, card))
    .map((line) => ({ node: line.node, weight: line.max - line.points }));
  // Array.prototype.sort стабилен, поэтому при равном весе сохраняется порядок таблицы.
  missing.sort((left, right) => right.weight - left.weight);

  const first = missing[0];
  const nextStep = first
    ? {
        node: first.node,
        gain: first.weight,
        levelAfter: levelOf(total + first.weight),
      }
    : null;

  return { total, lines, missing, nextStep };
}
