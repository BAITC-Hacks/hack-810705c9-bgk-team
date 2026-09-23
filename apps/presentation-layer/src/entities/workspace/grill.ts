import type { Task } from "./model";

/* Контракты воркфлоу stack1-result-control, приходящие как unknown из BFF. */

export type GrillQuestion = { id: string; text: string; cut?: string };

export type RoundPayload = {
  stage: "smart" | "user-story" | "job-story" | "acceptance-criteria";
  round: number;
  language: string;
  questions: GrillQuestion[];
};

export type TranslatorPayload = {
  question: string;
  language: string;
};

export type GrillArtifacts = {
  smart: {
    statement: string;
    measurable: { baseline: string; target: string };
    timeBound: { deadline: string; checkpoint: string };
  } | null;
  userStory: {
    statement: string;
    role: string;
    action: string;
    value: string;
  } | null;
  jobStory: { statement: string } | null;
  criteria: unknown[] | null;
};

export type GrillFinalOutput = {
  package: {
    summary: string;
    artifacts: GrillArtifacts;
    disagreements: string[];
  };
  translations: { language: string; content: string }[];
};

export function isRoundPayload(value: unknown): value is RoundPayload {
  const payload = value as RoundPayload | undefined;
  return (
    !!payload &&
    typeof payload.stage === "string" &&
    typeof payload.round === "number" &&
    Array.isArray(payload.questions)
  );
}

export function isTranslatorPayload(
  value: unknown,
): value is TranslatorPayload {
  const payload = value as TranslatorPayload | undefined;
  return !!payload && typeof payload.question === "string";
}

export function parseFinalOutput(value: unknown): GrillFinalOutput | null {
  const output = value as GrillFinalOutput | null;
  if (!output || typeof output !== "object") return null;
  if (typeof output.package?.summary !== "string") return null;
  if (!output.package.artifacts) return null;
  return output;
}

/**
 * Применяет итоговый пакет прожарки к карточке: заполненные воркфлоу поля
 * подтверждаются сразу — их дал сам бизнес в ходе интервью. Остальные поля
 * и описание (исходная идея) не трогаем.
 */
export function applyGrillPackage(
  task: Task,
  output: GrillFinalOutput,
): Task {
  const arts = output.package.artifacts;
  const fields = { ...task.fields };

  if (arts.jobStory?.statement) fields.need = arts.jobStory.statement;
  if (arts.userStory?.statement) fields.users = arts.userStory.statement;
  if (arts.smart?.statement) fields.outcome = arts.smart.statement;
  if (arts.smart?.measurable && arts.smart.timeBound) {
    fields.success = `${arts.smart.measurable.baseline} → ${arts.smart.measurable.target} к ${arts.smart.timeBound.deadline}`;
    fields.constraints = `Срок: ${arts.smart.timeBound.deadline}; чекпоинт: ${arts.smart.timeBound.checkpoint}`;
  }

  const confirmed = new Set(task.confirmedFields);
  for (const key of Object.keys(fields) as (keyof Task["fields"])[]) {
    if (fields[key].trim()) confirmed.add(key);
  }
  return { ...task, fields, confirmedFields: [...confirmed] };
}
