import { z } from "zod";
import {
  suggestQuestions,
  TASK_FIELDS,
  type Task,
  type TaskField,
} from "@/entities/workspace";

const fieldSchema = z.enum(
  TASK_FIELDS.map(({ key }) => key) as [TaskField, ...TaskField[]],
);

export const localAiOutputSchema = z.object({
  questions: z.array(z.object({
    field: fieldSchema,
    question: z.string().min(5).max(500),
  }).strict()).max(3),
  pendingConfirmation: z.array(fieldSchema).max(TASK_FIELDS.length),
}).strict();

export const LOCAL_AI_PROMPT = `Ты помогаешь бизнесу подготовить карточку задачи для студентов.
Вход: описание задачи, значения полей и список подтверждённых полей.
Верни JSON: {"questions": [{"field": "ключ поля", "question": "вопрос"}], "pendingConfirmation": ["ключ поля"]}.
Выбери до трёх пустых полей, начиная с наибольшего веса, и используй вопросы из справочника. Если пустых полей три или больше, верни три вопроса.
Заполненные поля не спрашивай повторно. Заполненные, но неподтверждённые поля перечисли в pendingConfirmation.
Не добавляй факты, не изменяй карточку и не подтверждай сведения за человека. Баллы считает код. Команду выбирает бизнес.
Допустимые ключи: ${TASK_FIELDS.map(({ key }) => key).join(", ")}.`;

export type LocalAiOutput = z.infer<typeof localAiOutputSchema>;

function expectedOutput(task: Task): LocalAiOutput {
  return {
    questions: suggestQuestions(task),
    pendingConfirmation: TASK_FIELDS.filter(
      ({ key }) => task.fields[key].trim() && !task.confirmedFields.includes(key),
    ).map(({ key }) => key),
  };
}

/** No model or network: serializes a deterministic reply through the same validated boundary. */
export function analyzeTaskLocally(task: Task, rawResponse?: string) {
  const input = {
    taskId: task.id,
    description: task.description,
    fields: { ...task.fields },
    confirmedFields: [...task.confirmedFields],
    fieldGuide: TASK_FIELDS.map(({ key, question, weight }) => ({ key, question, weight })),
  };
  const expected = expectedOutput(task);
  const rawOutput = rawResponse ?? JSON.stringify(expected, null, 2);
  let output = expected;
  let error: string | null = null;

  try {
    const parsed = localAiOutputSchema.safeParse(JSON.parse(rawOutput));
    if (!parsed.success) {
      error = "Ответ не соответствует формату: нужны вопросы и список полей для подтверждения.";
    } else if (JSON.stringify(parsed.data) !== JSON.stringify(expected)) {
      // This demo only accepts canonical questions and facts derived from the supplied task.
      error = "Ответ не соответствует карточке: найден повторный, лишний или изменённый пункт.";
    } else {
      output = parsed.data;
    }
  } catch {
    error = "Не удалось прочитать JSON ответа.";
  }

  return {
    prompt: LOCAL_AI_PROMPT,
    input,
    rawOutput,
    output,
    parseOk: error === null,
    fallbackUsed: error !== null,
    error,
  };
}
