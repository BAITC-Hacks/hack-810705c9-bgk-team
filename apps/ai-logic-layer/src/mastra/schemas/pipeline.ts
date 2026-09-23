import { z } from 'zod';

/**
 * Схемы пайплайна «Результат и Контроль» (Стек №1).
 * Стадии: SMART → User Story → Job Story → Acceptance Criteria → перевод.
 * Артефакты создаются на языке диалога (`language`), перевод — финальным агентом.
 */

export const STAGES = ['smart', 'user-story', 'job-story', 'acceptance-criteria'] as const;

export const StageId = z.enum(STAGES);
export type StageId = z.infer<typeof StageId>;

/** Жёсткий потолок раундов на стадию (skills: «scope too large → split the idea»). */
export const MAX_ROUNDS = 10;

/* ---------------------------------- input --------------------------------- */

export const PipelineInput = z.object({
  /** Первоначальное описание задачи (loose idea). */
  seedIdea: z.string().min(3),
  /** Язык диалога (BCP-47 тег, напр. "ru", "en"). */
  language: z.string().min(2),
});
export type PipelineInput = z.infer<typeof PipelineInput>;

/* --------------------------------- answers -------------------------------- */

export const Answer = z.object({
  questionId: z.string(),
  /** answer — обычный ответ; dont-know — «я не знаю» (валидный ответ);
   *  measured — пользователь сходил и измерил (ungrillable → посмотрел). */
  kind: z.enum(['answer', 'dont-know', 'measured']),
  value: z.string(),
});
export type Answer = z.infer<typeof Answer>;

export const RoundResume = z.object({
  answers: z.array(Answer).min(1),
});
export type RoundResume = z.infer<typeof RoundResume>;

export const RoundSuspend = z.object({
  stage: StageId,
  round: z.number().int().positive(),
  language: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** Какой «линз/вырез» касается вопроса: напр. "measurable", "so-that", "habit". */
      cut: z.string().optional(),
    }),
  ),
});
export type RoundSuspend = z.infer<typeof RoundSuspend>;

export const TranslatorResume = z.object({
  /** Языки перевода; пустой массив → повторный suspend с тем же вопросом. */
  targetLanguages: z.array(z.string()),
});
export type TranslatorResume = z.infer<typeof TranslatorResume>;

export const TranslatorSuspend = z.object({
  question: z.string(),
  language: z.string(),
});
export type TranslatorSuspend = z.infer<typeof TranslatorSuspend>;

/* -------------------------------- artifacts -------------------------------- */

export const SmartGoal = z.object({
  /** Цель одним вдохом (exit-условие grill-me-smart). */
  statement: z.string(),
  specific: z.string(),
  measurable: z.object({
    baseline: z.string(),
    target: z.string(),
  }),
  achievable: z.string(),
  relevant: z.string(),
  timeBound: z.object({
    deadline: z.string(),
    checkpoint: z.string(),
  }),
});
export type SmartGoal = z.infer<typeof SmartGoal>;

export const UserStory = z.object({
  statement: z.string(),
  role: z.string(),
  action: z.string(),
  value: z.string(),
});
export type UserStory = z.infer<typeof UserStory>;

export const JobStory = z.object({
  statement: z.string(),
  situation: z.string(),
  motivation: z.string(),
  outcome: z.string(),
  forces: z.object({
    push: z.string(),
    pull: z.string(),
    anxiety: z.string(),
    habit: z.string(),
  }),
});
export type JobStory = z.infer<typeof JobStory>;

export const CoverageCut = z.enum(['happy', 'boundary', 'error', 'rule', 'non-functional']);

export const AcceptanceScenario = z.object({
  id: z.string(),
  given: z.string(),
  when: z.string(),
  then: z.string(),
  cut: CoverageCut,
});
export type AcceptanceScenario = z.infer<typeof AcceptanceScenario>;

export const Criteria = z.array(AcceptanceScenario).min(1);
export type Criteria = z.infer<typeof Criteria>;

/** Структурный контроль артефакта при коммите стадии (zod-парсинг до exit-гейта). */
export const STAGE_ARTIFACT_SCHEMA: Record<StageId, z.ZodType> = {
  smart: SmartGoal,
  'user-story': UserStory,
  'job-story': JobStory,
  'acceptance-criteria': Criteria,
};

export const Artifacts = z.object({
  smart: SmartGoal.nullable(),
  userStory: UserStory.nullable(),
  jobStory: JobStory.nullable(),
  criteria: Criteria.nullable(),
});
export type Artifacts = z.infer<typeof Artifacts>;

/* ------------------------------ exit reports ------------------------------- */

export const TestCheck = z.object({
  id: z.string(),
  holds: z.boolean(),
  evidence: z.string(),
});
export type TestCheck = z.infer<typeof TestCheck>;

export const CoverageCheck = z.object({
  cut: z.string(),
  status: z.enum(['covered', 'not-applicable']),
  note: z.string().optional(),
});
export type CoverageCheck = z.infer<typeof CoverageCheck>;

export const ExitReport = z.object({
  tests: z.array(TestCheck),
  coverage: z.array(CoverageCheck),
  committed: z.boolean(),
  /** Фраза цели/истории одним вдохом; null/undefined, если не удалось. */
  statement: z.string().nullish(),
  capReached: z.boolean().optional(),
});
export type ExitReport = z.infer<typeof ExitReport>;


/* ------------------------------ round reports ------------------------------ */

export const RoundReport = z.object({
  phase: z.enum(['questions', 'commit']),
  frontierEmpty: z.boolean(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        cut: z.string().optional(),
      }),
    )
    .optional(),
  /** Черновик артефакта стадии; форма — STAGE_ARTIFACT_SCHEMA[stage].
   *  Без z.unknown(): JSON Schema для OpenAI response_format требует type-ключ
   *  (union покрывает объекты стадий и массив критериев). */
  artifact: z
    .union([z.looseObject({}), z.array(z.looseObject({}))])
    .optional(),
  notes: z.string().optional(),
});
export type RoundReport = z.infer<typeof RoundReport>;

/* ----------------------------- pipeline state ------------------------------ */

export const PipelineState = z.object({
  seedIdea: z.string(),
  language: z.string(),
  /** Один memory-thread на весь run — контекст переходит между стадиями и агентами. */
  threadId: z.string(),
  resource: z.string(),
  stage: StageId,
  round: z.number().int().nonnegative(),
  stageDone: z.boolean(),
  capReached: z.boolean(),
  /** zod 4: z.unknown() требует presence ключа — снапшот JSON теряет
   *  `draft: undefined`, поэтому ключ обязан быть optional (resume шага). */
  draft: z.unknown().optional(),
  /** Коммитнутые артефакты: stage → value (прошёл структурный + семантический контроль). */
  artifacts: z.partialRecord(StageId, z.unknown()),
  exitReports: z.partialRecord(StageId, ExitReport),
  failingChecks: ExitReport.nullable(),
});
export type PipelineState = z.infer<typeof PipelineState>;

/* --------------------------------- output ---------------------------------- */

export const FinalPackage = z.object({
  seedIdea: z.string(),
  language: z.string(),
  artifacts: Artifacts,
  exitReports: z.partialRecord(StageId, ExitReport),
  /** Итоговое резюме собранной задачи. */
  summary: z.string(),
  /** Расхождения User Story ↔ Job Story — «the finding» из skills. */
  disagreements: z.array(z.string()),
});
export type FinalPackage = z.infer<typeof FinalPackage>;

export const ToTranslate = z.object({
  seedIdea: z.string(),
  language: z.string(),
  threadId: z.string(),
  resource: z.string(),
  package: FinalPackage,
});
export type ToTranslate = z.infer<typeof ToTranslate>;

export const WithLanguages = ToTranslate.extend({
  targetLanguages: z.array(z.string()),
});
export type WithLanguages = z.infer<typeof WithLanguages>;

export const FinalOutput = z.object({
  package: FinalPackage,
  translations: z.array(z.object({ language: z.string(), content: z.string() })),
});
export type FinalOutput = z.infer<typeof FinalOutput>;


/* ------------------------------- misc notes -------------------------------- */

export const CompileNotes = z.object({
  summary: z.string(),
  disagreements: z.array(z.string()),
});
export type CompileNotes = z.infer<typeof CompileNotes>;

export const TranslatorQuestion = z.object({
  question: z.string(),
});
export type TranslatorQuestion = z.infer<typeof TranslatorQuestion>;

export const Translations = z.object({
  translations: z.array(
    z.object({
      language: z.string(),
      content: z.string(),
    }),
  ),
});
export type Translations = z.infer<typeof Translations>;
