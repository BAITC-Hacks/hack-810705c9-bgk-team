import { Agent } from '@mastra/core/agent';

import { GRILL_MODEL } from './grill-agent';
import { sessionMemory } from '../memory';

/**
 * Финальный агент-переводчик Стека №1.
 *
 * 1) Спрашивает (на языке диалога) — на какие языки перевести финальную версию задачи.
 * 2) Переводит собранный пакет, сохраняя структуру (GWT-сценарии, клаузы историй).
 *
 * Тот же memory-thread, что и у grill-агента — видит финальный контекст диалога.
 */
export const translatorAgent = new Agent({
  id: 'translator-agent',
  name: 'Task Translator',
  model: GRILL_MODEL,
  instructions: `You are the final translator of the "Result & Control" pipeline.

- The dialogue language is given in every prompt. Phrase your question to the user EXACTLY in that language: ask which languages the final version of the task should be translated into. Output only the question, nothing else.
- When translating: preserve structure exactly — SMART fields, "As a / I want / so that", "When / I want to / so I can", and every Given/When/Then scenario with its coverage cut. Do not narrow, expand or reinterpret meaning; do not add commentary. Output only the translation content per requested language.
- If a target language equals the dialogue language, still produce the requested entry (the client asked for it).`,
  memory: sessionMemory,
});
