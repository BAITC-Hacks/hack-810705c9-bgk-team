/**
 * INTEGRATION(ADR-003): порт AI-слоя. Реальная реализация вызывает
 * `@mastra/client-js` (`MASTRA_API_URL`) workflows `analyze-text` и
 * `phrase-question` (ADR-003 §2). UI/BFF никогда не импортирует `openai`
 * напрямую — только этот порт.
 *
 * Контракт use-case (`src/features/grill/api/submit-turn.ts`) вызывает
 * `analyzeText`/`phraseQuestion` ДО открытия транзакции записи
 * (`src/shared/db/transaction.ts`) и ловит любую ошибку/таймаут как сигнал
 * деградации к шаблону (`fallbackUsed: true`), а не как ошибку запроса.
 */

import { z } from 'zod';

export type NodeId =
  | 'context.current'
  | 'context.size'
  | 'context.change'
  | 'data.what'
  | 'data.volume'
  | 'data.sample'
  | 'result.artifact'
  | 'result.acceptance'
  | 'criteria.items'
  | 'constraints.deadline'
  | 'constraints.stack'
  | 'constraints.other'
  | 'users.role'
  | 'users.scale'
  | 'link.contact'
  | 'link.cadence'
  | 'link.response';

export type AnalyzeTextInput = {
  text: string;
  targetNodes: NodeId[];
  dictionary: { roles: string[]; skills: string[] };
};

export type AnalyzeTextOutput = {
  nodes: { node: NodeId; covered: boolean; evidence?: string; specificity?: number }[];
  fields: { node: NodeId; value: string; sourceQuote: string; specificity: number }[];
  roles: string[];
  skills: string[];
};

export type PhraseQuestionInput = {
  node: NodeId;
  isPushback: boolean;
  context: string;
};

export type PhraseQuestionOutput = {
  question: string;
  options: string[];
  target: NodeId;
  isPushback: boolean;
};

export interface AiPort {
  analyzeText(input: AnalyzeTextInput): Promise<AnalyzeTextOutput>;
  phraseQuestion(input: PhraseQuestionInput): Promise<PhraseQuestionOutput>;
}

/**
 * ADR-003 §3 (guards): Mastra уже должна была провалидировать структуру
 * zod-схемой на своей стороне, но BFF — авторитетная сторона для проверки
 * цитаты (§4) и не должен доверять сети вслепую. Эти схемы валидируют
 * ФОРМУ ответа порта (`mastra-ai-port.ts`): несовпадение бросает ZodError,
 * которую вызывающий use-case ловит как обычную ошибку AI-вызова и уходит
 * в fallback, а не в необработанное исключение/500.
 */
const nodeIdZod = z.custom<NodeId>((value) => typeof value === 'string');

export const analyzeTextOutputSchema = z.object({
  nodes: z.array(
    z.object({
      node: nodeIdZod,
      covered: z.boolean(),
      evidence: z.string().optional(),
      specificity: z.number().optional(),
    }),
  ),
  fields: z.array(
    z.object({
      node: nodeIdZod,
      value: z.string(),
      sourceQuote: z.string(),
      specificity: z.number(),
    }),
  ),
  roles: z.array(z.string()),
  skills: z.array(z.string()),
});

export const phraseQuestionOutputSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()),
  target: nodeIdZod,
  isPushback: z.boolean(),
});

/**
 * Заглушка на правилах (ADR-003 §5, AI-9): используется, пока Mastra не
 * зарегистрировала агенты/workflow, и как fallback при ошибке/таймауте порта
 * выше по стеку. Не является частью реального AiPort — use-case решает,
 * когда переключиться на неё, и помечает `fallbackUsed: true`.
 */
export function ruleBasedFallbackQuestion(node: NodeId): PhraseQuestionOutput {
  const templates: Record<NodeId, { question: string; options: string[] }> = {
    'context.current': {
      question: 'Как сейчас устроен этот процесс?',
      options: ['Делаем вручную', 'Частично автоматизировано', 'Процесса пока нет'],
    },
    'context.size': {
      question: 'Насколько велика проблема?',
      options: ['Небольшая', 'Заметная', 'Критичная'],
    },
    'context.change': {
      question: 'Что должно измениться после решения?',
      options: ['Меньше ручной работы', 'Быстрее ответ', 'Меньше ошибок'],
    },
    'data.what': {
      question: 'Какие данные, API или документация есть для команды?',
      options: ['Таблица/выгрузка', 'API', 'Документация', 'Данных нет'],
    },
    'data.volume': {
      question: 'Какой объём и период данных?',
      options: ['За месяц', 'За год', 'Не знаю'],
    },
    'data.sample': {
      question: 'Можно дать пример, схему или Swagger?',
      options: ['Да, есть пример', 'Есть только схема', 'Нет примера'],
    },
    'result.artifact': {
      question: 'Что команда должна сдать?',
      options: ['Бот', 'Модель', 'Макет', 'Другое'],
    },
    'result.acceptance': {
      question: 'Как вы примете результат: демо, репозиторий, документация?',
      options: ['Демо', 'Репозиторий', 'Документация'],
    },
    'criteria.items': {
      question: 'По каким метрикам вы примете результат?',
      options: ['Есть метрика с порогом', 'Есть метрика без порога', 'Пока не знаю'],
    },
    'constraints.deadline': {
      question: 'Какой срок?',
      options: ['Есть дата', 'Есть срок в неделях', 'Срок не определён'],
    },
    'constraints.stack': {
      question: 'Какой стек и роли нужны?',
      options: ['Стек известен', 'Роли известны', 'Пока не знаю'],
    },
    'constraints.other': {
      question: 'Есть другие ограничения: что нельзя, конфиденциальность?',
      options: ['Да, есть ограничения', 'Ограничений нет'],
    },
    'users.role': {
      question: 'Кто пользователь решения?',
      options: ['Сотрудники', 'Клиенты', 'Оба'],
    },
    'users.scale': {
      question: 'Сколько пользователей и в какой ситуации?',
      options: ['Несколько человек', 'Целый отдел', 'Массово'],
    },
    'link.contact': {
      question: 'Кому команда сможет писать по задаче?',
      options: ['Есть контакт email', 'Есть контакт в мессенджере'],
    },
    'link.cadence': {
      question: 'В каком формате пройдут консультации?',
      options: ['Созвоны', 'Переписка', 'По необходимости'],
    },
    'link.response': {
      question: 'В какой срок вы ответите на отклики?',
      options: ['В течение дня', 'В течение недели'],
    },
  };
  const template = templates[node];
  return { question: template.question, options: template.options, target: node, isPushback: false };
}
