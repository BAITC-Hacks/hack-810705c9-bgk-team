import type { GrillQuestion, RoundPayload } from "@/entities/workspace";
import type {
  RatingLevel,
  RatingReport,
} from "@/shared/api/contracts/assistant";

export type { RatingReport };

/* Маппинги для флоу «оценка → прожарка → переоценка» в чате. */

const STAGE_LABELS: Record<RoundPayload["stage"], string> = {
  smart: "SMART",
  "user-story": "User Story",
  "job-story": "Job Story",
  "acceptance-criteria": "Acceptance Criteria",
};

export const RATING_LEVEL_LABELS: Record<RatingLevel, string> = {
  draft: "Черновик",
  working: "Рабочая",
  ready: "Готовая",
  priority: "Приоритетная",
};

const CRITERION_LABELS: Record<string, string> = {
  context_and_need: "Контекст и потребность",
  data_and_materials: "Данные и материалы",
  expected_result: "Ожидаемый результат",
  success_criteria: "Критерии успеха",
  constraints: "Ограничения",
  users: "Пользователи",
  business_connection: "Связь с бизнесом",
};

export const GRILL_INTRO_MESSAGE = [
  "Запускаю прожарку: превращу сырую идею в задачу по методологии",
  "SMART → User Story → Job Story → Acceptance Criteria.",
  "Буду задавать вопросы стадиями — отвечайте по номерам,",
  "каждый ответ с новой строки. «Не знаю» — тоже честный ответ.",
].join("\n");

export const GRILL_FINISHED_MESSAGE =
  "Прожарка завершена — карточка обновлена итоговым пакетом, поля подтверждены. Запускаю оценщика…";

/** Вопросы раунда → текст сообщения ассистента. */
export function formatRoundMessage(payload: RoundPayload): string {
  return [
    `Прожарка · стадия ${STAGE_LABELS[payload.stage] ?? payload.stage} · раунд ${payload.round}`,
    "",
    ...payload.questions.map(
      (question, index) => `${index + 1}. ${question.text} (${question.id})`,
    ),
    "",
    "Отвечайте по номерам, каждый ответ с новой строки.",
  ].join("\n");
}

export function formatTranslatorMessage(question: string): string {
  return [
    "Финальный пакет собран. Последний вопрос переводчика:",
    "",
    question,
    "",
    "Напишите языки через запятую, например: русский, английский.",
  ].join("\n");
}

/**
 * Ответы пользователя → answers[] для resume раунда: строки сопоставляются
 * с вопросами по порядку; для одного вопроса текст берётся целиком;
 * «не знаю» распознаётся как валидный вид ответа dont-know.
 */
export function parseRoundAnswers(
  text: string,
  questions: GrillQuestion[],
): { questionId: string; kind: "answer" | "dont-know"; value: string }[] {
  if (!questions.length) return [];
  const cleaned = text.trim();
  if (!cleaned) return [];

  if (questions.length === 1) {
    return [toAnswer(questions[0].id, cleaned)];
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim().replace(/^\d+\s*[.)]\s*/, ""))
    .filter(Boolean);

  return lines
    .slice(0, questions.length)
    .map((line, index) => toAnswer(questions[index].id, line));
}

function toAnswer(
  questionId: string,
  value: string,
): { questionId: string; kind: "answer" | "dont-know"; value: string } {
  const kind = /^не\s+знаю|^не\s+помню|^незнаю/i.test(value)
    ? "dont-know"
    : "answer";
  return { questionId, kind, value };
}

const LANGUAGE_ALIASES: Record<string, string> = {
  ru: "ru",
  рус: "ru",
  русск: "ru",
  russian: "ru",
  en: "en",
  англ: "en",
  english: "en",
  kk: "kk",
  казах: "kk",
  uz: "uz",
  узбек: "uz",
  kg: "kg",
  кыргыз: "kg",
  de: "de",
  немец: "de",
  fr: "fr",
  франц: "fr",
  es: "es",
  испан: "es",
};

/** Свободный текст → BCP-47 теги для resume переводчика ([] → не распознано). */
export function parseTargetLanguages(text: string): string[] {
  const tokens = text
    .split(/[,;\n]+/)
    .map((token) => token.trim().toLocaleLowerCase("ru"))
    .filter(Boolean);
  const tags = new Set<string>();
  for (const token of tokens) {
    const key = token.replace(/[^a-zа-яё]/gu, "");
    const alias = Object.entries(LANGUAGE_ALIASES)
      .filter(([name]) => key.startsWith(name) || name.startsWith(key))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
    if (alias) tags.add(alias);
    else if (/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(token)) tags.add(token);
  }
  return [...tags];
}

/** Отчёт оценщика → короткое сообщение чата. */
export function formatRatingMessage(report: RatingReport): string {
  const lines = [
    `Готовность: ${report.score} / 100 · ${RATING_LEVEL_LABELS[report.level]}`,
  ];
  if (report.verdict) lines.push(report.verdict);
  if (report.breakdown.length) {
    lines.push(
      "",
      ...report.breakdown.map(
        (item) =>
          `- ${CRITERION_LABELS[item.criterion] ?? item.criterion}: ${item.awarded} / ${item.max}`,
      ),
    );
  }
  if (report.missing.length) {
    lines.push("", "Не хватает:", ...report.missing.map((m) => `— ${m}`));
  }
  const recalc = report.recalculation;
  lines.push(
    "",
    recalc.firstEvaluation || recalc.previousScore === null
      ? "Это первичная оценка задачи."
      : `Пересчёт: было ${recalc.previousScore} → стало ${report.score} (Δ${
          (recalc.delta ?? 0) >= 0 ? "+" : ""
        }${recalc.delta ?? 0}).`,
  );
  return lines.join("\n");
}

export const RATING_ERROR_MESSAGE =
  "Оценщик сейчас недоступен или ответил невалидно. Попробуйте «Оценить задачу» позже.";
