import type { NodeId } from '../contracts/common';

/**
 * INTEGRATION(ADR-003 §5): заглушка на правилах, используемая, пока
 * `ai-logic-layer` не отвечает (AI_ENABLED=false, таймаут, ошибка, ok:false).
 * Регулярки для чисел, периодов, URL, email — как описано в решении ADR-003.
 * Владелец ADR-003 переносит эту логику в `src/entities/grill` BFF, где ей и
 * место по решению; здесь она нужна только чтобы demo не падало без Mastra.
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const URL_RE = /https?:\/\/\S+/;
const NUMBER_RE = /\d+/;
const DEADLINE_RE = /\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?|через\s+\d+\s+(?:недел\w*|месяц\w*|дн\w*)/i;

export type RuleBasedField = { node: NodeId; value: string; sourceQuote: string };

/** Черновик/ход с несколькими открытыми узлами: точечные регулярки. */
export function ruleBasedAnalyze(text: string, targetNodes: NodeId[]): RuleBasedField[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const results: RuleBasedField[] = [];

  const email = trimmed.match(EMAIL_RE)?.[0];
  if (targetNodes.includes('link.contact') && email) {
    results.push({ node: 'link.contact', value: email, sourceQuote: trimmed });
  }

  const url = trimmed.match(URL_RE)?.[0];
  if (targetNodes.includes('data.sample') && url) {
    results.push({ node: 'data.sample', value: url, sourceQuote: trimmed });
  }

  const deadline = trimmed.match(DEADLINE_RE)?.[0];
  if (targetNodes.includes('constraints.deadline') && deadline) {
    results.push({ node: 'constraints.deadline', value: deadline, sourceQuote: trimmed });
  }

  const number = trimmed.match(NUMBER_RE)?.[0];
  if (number) {
    if (targetNodes.includes('context.size')) {
      results.push({ node: 'context.size', value: number, sourceQuote: trimmed });
    }
    if (targetNodes.includes('data.volume')) {
      results.push({ node: 'data.volume', value: number, sourceQuote: trimmed });
    }
  }

  return results;
}

/**
 * Ход прожарки: один целевой узел. ADR-003 §5: «для целевого узла весь ответ
 * становится значением поля, а цитатой служит весь ответ» — AI-6 выполняется
 * тривиально.
 */
export function ruleBasedSingleField(node: NodeId, answer: string): RuleBasedField {
  const trimmed = answer.trim();
  return { node, value: trimmed, sourceQuote: trimmed };
}
