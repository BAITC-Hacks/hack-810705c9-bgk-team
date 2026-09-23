import 'server-only';

import { MastraClient } from '@mastra/client-js';
import { z } from 'zod';

const log = z.object({
  kind: z.string(), agent: z.string(), model: z.string(), prompt: z.string(),
  input: z.string(), raw_output: z.string(), parse_ok: z.boolean(),
  retry_count: z.number(), dropped: z.array(z.string()), latency_ms: z.number(),
  error: z.string().optional(),
});
const node = z.object({
  node: z.string(), covered: z.boolean(), evidence: z.string().optional(),
  specificity: z.enum(['specific', 'vague']),
});
const field = z.object({
  node: z.string(), value: z.string(), source_quote: z.string(),
  specificity: z.enum(['specific', 'vague']),
});
const analysis = z.object({
  ok: z.literal(true), nodes: z.array(node), fields: z.array(field),
  roles: z.array(z.string()), skills: z.array(z.string()), log,
});
const question = z.object({
  ok: z.literal(true), question: z.string().min(5), options: z.array(z.string()),
  target: z.string(), is_pushback: z.boolean(), log,
});

export type AnalyzeTextInput = {
  text: string;
  targetNodes: string[];
  dictionary: { roles: string[]; skills: string[] };
};
export type AnalyzeTextResult = z.infer<typeof analysis>;
export type PhraseQuestionInput = { node: string; isPushback: boolean; context: string };
export type PhraseQuestionResult = z.infer<typeof question>;

async function run<T extends z.ZodType>(id: string, inputData: Record<string, unknown>, schema: T): Promise<z.infer<T> | null> {
  if (process.env.AI_ENABLED === 'false' || !process.env.MASTRA_API_URL) return null;
  try {
    const client = new MastraClient({
      baseUrl: process.env.MASTRA_API_URL,
      retries: 0,
      abortSignal: AbortSignal.timeout(20_000),
    });
    const workflow = client.getWorkflow(id);
    const run = await workflow.createRun();
    const response = await run.startAsync({ inputData });
    if (response.status !== 'success') return null;
    const parsed = schema.safeParse(response.result);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function analyzeText(input: AnalyzeTextInput): Promise<AnalyzeTextResult | null> {
  return run('analyze-text', input, analysis);
}

export function phraseQuestion(input: PhraseQuestionInput): Promise<PhraseQuestionResult | null> {
  return run('phrase-question', input, question);
}
