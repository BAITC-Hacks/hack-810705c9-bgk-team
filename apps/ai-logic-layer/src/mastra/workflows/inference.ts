import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const model = process.env.LLM_MODEL ?? 'openai/gpt-5.4-nano';
const classifierModel = process.env.CLASSIFIER_MODEL ?? 'openai/gpt-5.4-nano';

const classifier = new Agent({
  id: 'classifier',
  name: 'Classifier',
  model: classifierModel,
  instructions: 'Определи, на какие из переданных узлов текст отвечает. covered=true только при точной цитате evidence из текста. Роли и навыки выбирай только из переданного справочника. Не вычисляй рейтинг, fit или состояние задачи.',
});
const extractor = new Agent({
  id: 'card-extractor',
  name: 'Card extractor',
  model,
  instructions: 'Разложи текст по переданным узлам. value — только слова пользователя, source_quote — точная подстрока текста. Не додумывай факты. Не вычисляй рейтинг или состояние задачи.',
});
const griller = new Agent({
  id: 'griller',
  name: 'Griller',
  model,
  instructions: 'Сформулируй один короткий вопрос по заданному узлу на русском. Не придумывай факты о бизнесе. Дай до четырёх вариантов формата ответа без цифр. При isPushback попроси число, диапазон или пример. Не принимай решений о ходе прожарки.',
});

const input = z.object({
  text: z.string().min(1),
  targetNodes: z.array(z.string()).min(1),
  dictionary: z.object({ roles: z.array(z.string()), skills: z.array(z.string()) }),
});
const node = z.object({
  node: z.string(), covered: z.boolean(), evidence: z.string().optional(),
  specificity: z.enum(['specific', 'vague']),
});
const field = z.object({
  node: z.string(), value: z.string(), source_quote: z.string(),
  specificity: z.enum(['specific', 'vague']),
});
const classification = z.object({ nodes: z.array(node), roles: z.array(z.string()), skills: z.array(z.string()) });
const extraction = z.object({ fields: z.array(field) });
const log = z.object({
  kind: z.string(), agent: z.string(), model: z.string(), prompt: z.string(),
  input: z.string(), raw_output: z.string(), parse_ok: z.boolean(),
  retry_count: z.number(), dropped: z.array(z.string()), latency_ms: z.number(),
  error: z.string().optional(),
});
const analysisOutput = z.object({
  ok: z.boolean(), nodes: z.array(node), fields: z.array(field),
  roles: z.array(z.string()), skills: z.array(z.string()), log,
});
const questionInput = z.object({ node: z.string().min(1), isPushback: z.boolean(), context: z.string() });
const question = z.object({
  question: z.string().min(5).max(300), options: z.array(z.string().max(40)).max(4),
  target: z.string(), is_pushback: z.boolean(),
});
const questionOutput = question.extend({ ok: z.boolean(), log });

function normalized(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function grounded(quote: string, text: string) {
  return Boolean(normalized(quote)) && normalized(text).includes(normalized(quote));
}

async function generate<T extends z.ZodType>(agent: Agent, prompt: string, schema: T, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  let retryCount = 0;
  try {
    for (; retryCount < 2; retryCount++) {
      try {
        const result = await agent.generate(prompt, {
          structuredOutput: { schema }, abortSignal: controller.signal,
        });
        const parsed = schema.safeParse(result.object);
        if (parsed.success) return { value: parsed.data as z.infer<T>, retryCount, raw: JSON.stringify(result.object) };
      } catch (error) {
        if (controller.signal.aborted || retryCount === 1) throw error;
      }
    }
    throw new Error('invalid structured output');
  } finally {
    clearTimeout(timer);
  }
}

const analyzeStep = createStep({
  id: 'classify-and-extract', inputSchema: input, outputSchema: analysisOutput,
  execute: async ({ inputData }) => {
    const started = Date.now();
    const prompt = JSON.stringify(inputData);
    const [classified, extracted] = await Promise.all([
      generate(classifier, prompt, classification, 5_000),
      generate(extractor, prompt, extraction, 15_000),
    ]);
    const dropped: string[] = [];
    const target = new Set(inputData.targetNodes);
    const nodes = classified.value.nodes.filter((item) => {
      const valid = target.has(item.node) && (!item.covered || grounded(item.evidence ?? '', inputData.text));
      if (!valid) dropped.push(`node:${item.node}`);
      return valid;
    });
    const fields = extracted.value.fields.filter((item) => {
      const valid = target.has(item.node) && grounded(item.source_quote, inputData.text) && grounded(item.value, inputData.text);
      if (!valid) dropped.push(`field:${item.node}`);
      return valid;
    });
    const roles = classified.value.roles.filter((item) => {
      const valid = inputData.dictionary.roles.includes(item);
      if (!valid) dropped.push(`role:${item}`);
      return valid;
    });
    const skills = classified.value.skills.filter((item) => {
      const valid = inputData.dictionary.skills.includes(item);
      if (!valid) dropped.push(`skill:${item}`);
      return valid;
    });
    return {
      ok: true, nodes, fields, roles, skills,
      log: { kind: 'analyze-text', agent: 'classifier,card-extractor', model: `${classifierModel},${model}`,
        prompt, input: inputData.text, raw_output: JSON.stringify({ classified: classified.raw, extracted: extracted.raw }),
        parse_ok: true, retry_count: classified.retryCount + extracted.retryCount, dropped, latency_ms: Date.now() - started },
    };
  },
});

const phraseStep = createStep({
  id: 'phrase-and-guard', inputSchema: questionInput, outputSchema: questionOutput,
  execute: async ({ inputData }) => {
    const started = Date.now();
    const prompt = JSON.stringify(inputData);
    const result = await generate(griller, prompt, question, 15_000);
    const dropped: string[] = [];
    const options = result.value.options.filter((option) => {
      const valid = !/\p{N}/u.test(option);
      if (!valid) dropped.push(`option:${option}`);
      return valid;
    });
    const ok = result.value.target === inputData.node && result.value.is_pushback === inputData.isPushback;
    if (!ok) dropped.push('target-or-pushback-mismatch');
    return { ...result.value, options, ok,
      log: { kind: 'phrase-question', agent: 'griller', model, prompt, input: inputData.context,
        raw_output: result.raw, parse_ok: true, retry_count: result.retryCount, dropped, latency_ms: Date.now() - started },
    };
  },
});

export const analyzeTextWorkflow = createWorkflow({
  id: 'analyze-text', inputSchema: input, outputSchema: analysisOutput,
}).then(analyzeStep).commit();

export const phraseQuestionWorkflow = createWorkflow({
  id: 'phrase-question', inputSchema: questionInput, outputSchema: questionOutput,
}).then(phraseStep).commit();
