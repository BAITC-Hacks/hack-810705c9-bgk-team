import 'server-only';

import { MastraClient } from '@mastra/client-js';
import { z } from 'zod';
import { GRILL_NODES } from '@/entities/grill/model';

const log = z.object({
  kind: z.string(), agent: z.string(), model: z.string(), prompt: z.string(),
  input: z.string(), raw_output: z.string(), parse_ok: z.boolean(),
  retry_count: z.number().int().nonnegative(), dropped: z.array(z.string()), latency_ms: z.number().int().nonnegative(),
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
  ok: z.literal(true), question: z.string().min(5).max(2000), options: z.array(z.string().min(1).max(500)).max(10),
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

const failure = z.object({ ok: z.literal(false), log });
export type InferenceFailure = z.infer<typeof failure>;
export type InferenceLog = z.infer<typeof log>;
const knownNodes = new Set<string>(GRILL_NODES.map(({ node }) => node));
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const grounded = (quote: string | undefined, text: string) => Boolean(quote && normalize(quote) && normalize(text).includes(normalize(quote)));

async function run<T extends z.ZodType>(id: string, inputData: Record<string, unknown>, schema: T, signal?: AbortSignal): Promise<z.infer<T> | InferenceFailure> {
  const started = Date.now();
  const unavailable = (error: string): InferenceFailure => ({ ok: false, log: {
    kind: id, agent: 'fallback', model: '', prompt: '', input: JSON.stringify(inputData),
    raw_output: '', parse_ok: false, retry_count: 0, dropped: [], latency_ms: Date.now() - started, error,
  } });
  if (process.env.AI_ENABLED === 'false') return unavailable('AI_DISABLED');
  if (!process.env.MASTRA_API_URL) return unavailable('MASTRA_NOT_CONFIGURED');
  if (signal?.aborted) return unavailable('INFERENCE_DEADLINE');
  try {
    const client = new MastraClient({ baseUrl: process.env.MASTRA_API_URL, retries: 0,
      abortSignal: signal ?? AbortSignal.timeout(20_000) });
    const workflow = client.getWorkflow(id);
    const workflowRun = await workflow.createRun();
    const response = await workflowRun.startAsync({ inputData });
    if (response.status !== 'success') return unavailable('WORKFLOW_NOT_SUCCESSFUL');
    const parsed = z.union([schema, failure]).safeParse(response.result);
    return parsed.success ? parsed.data : unavailable('INVALID_INFERENCE_RESPONSE');
  } catch {
    return unavailable(signal?.aborted ? 'INFERENCE_DEADLINE' : 'INFERENCE_UNAVAILABLE');
  }
}

export async function analyzeText(input: AnalyzeTextInput, signal?: AbortSignal): Promise<AnalyzeTextResult | InferenceFailure> {
  const result = await run('analyze-text', input, analysis, signal);
  if (!result.ok) return result;
  const requested = new Set(input.targetNodes.filter(node => knownNodes.has(node)));
  const dropped = [...result.log.dropped];
  const seenNodes = new Set<string>();
  const nodes = result.nodes.filter(item => {
    const valid = requested.has(item.node) && !seenNodes.has(item.node) && (!item.covered || grounded(item.evidence, input.text));
    if (!valid) dropped.push(`bff:node:${item.node}`);
    else seenNodes.add(item.node);
    return valid;
  });
  const seenFields = new Set<string>();
  const fields = result.fields.filter(item => {
    // Plain text cannot author the structured three-part acceptance criteria.
    const valid = requested.has(item.node) && item.node !== 'criteria.items' && !seenFields.has(item.node) && grounded(item.source_quote, input.text) && Boolean(item.value.trim());
    if (!valid) dropped.push(`bff:field:${item.node}`);
    else seenFields.add(item.node);
    return valid;
  });
  const filterTags = (values: string[], dictionary: string[], kind: string) => [...new Set(values.filter(value => {
    if (dictionary.includes(value)) return true;
    dropped.push(`bff:${kind}:${value}`);
    return false;
  }))];
  return { ...result, nodes, fields, roles: filterTags(result.roles, input.dictionary.roles, 'role'),
    skills: filterTags(result.skills, input.dictionary.skills, 'skill'), log: { ...result.log, dropped } };
}

export async function phraseQuestion(input: PhraseQuestionInput, signal?: AbortSignal): Promise<PhraseQuestionResult | InferenceFailure> {
  const result = await run('phrase-question', input, question, signal);
  if (!result.ok) return result;
  if (!knownNodes.has(input.node) || result.target !== input.node || result.is_pushback !== input.isPushback) {
    return { ok: false, log: { ...result.log, parse_ok: false, error: 'QUESTION_TARGET_MISMATCH', dropped: [...result.log.dropped, 'bff:target'] } };
  }
  const options = [...new Set(result.options.filter(option => !/\p{N}/u.test(option)))];
  return { ...result, options, log: { ...result.log, dropped: [...result.log.dropped, ...result.options.filter(option => /\p{N}/u.test(option)).map(() => 'bff:numeric-option')] } };
}
