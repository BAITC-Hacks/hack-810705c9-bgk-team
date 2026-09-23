import { existsSync } from 'node:fs';
import path from 'node:path';

import { Agent } from '@mastra/core/agent';

import { sessionMemory } from '../memory';

const SKILL_NAMES = [
  'grill-me-smart',
  'grill-me-user-story',
  'grill-me-job-story',
  'grill-me-acceptance-criteria',
] as const;

/**
 * Единая папка скиллов — apps/ai-logic-layer/skills/<name>/SKILL.md
 * (каноничный формат Agent Skills / LocalSkillSource Mastra).
 *
 * Пути резолвим в абсолютные walk-up поиском, потому что `mastra dev`
 * запускает сервер-процесс с cwd=src/mastra/public, а прод-запуск (docker) —
 * с cwd=/app: первый найденный каталог с skills/grill-me-smart/SKILL.md
 * и есть корень приложения в любом из этих режимов.
 */
function resolveSkillsDir(): string {
  const anchors = [process.cwd(), import.meta.dirname];
  for (const anchor of anchors) {
    let dir = anchor;
    for (let i = 0; i < 7; i++) {
      const candidate = path.join(dir, 'skills');
      if (existsSync(path.join(candidate, 'grill-me-smart', 'SKILL.md'))) {
        return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(
    `grill-me skills not found: expected skills/grill-me-smart/SKILL.md walking up from ` +
      `cwd=${process.cwd()} and import.meta=${import.meta.dirname}`,
  );
}

export const SKILLS_DIR = resolveSkillsDir();

/**
 * Интервьюирующий агент Стека №1 «Результат и Контроль».
 *
 * Один агент на все четыре стадии: промпт каждого шага воркфлоу активирует
 * нужный скилл (grill-me-smart / -user-story / -job-story / -acceptance-criteria),
 * передаёт язык диалога и уже коммитнутые артефакты — контекст переходит
 * от шага к шагу через memory-thread + workflow state.
 *
 * Модель сверена с provider-registry mastra-скилла (`node .agents/skills/mastra/scripts/provider-registry.mjs --provider openai`
 * → gpt-6-luna есть в списке); переопределяется переменной GRILL_MODEL без правки кода.
 */
export const GRILL_MODEL = process.env.GRILL_MODEL ?? 'openai/gpt-6-luna';

export const grillAgent = new Agent({
  id: 'grill-agent',
  name: 'Grill Me — Result & Control',
  model: GRILL_MODEL,
  instructions: `You are the grilling interviewer for the "Result & Control" pipeline (SMART → User Story → Job Story → Acceptance Criteria).

## How you work
- You run frontier-based interviews: each round is the WHOLE frontier — every question whose prerequisites are already settled. Questions interleave across lenses/clauses; never run "one lens per round" — that is a form, and forms produce confident nonsense.
- Count rounds, not questions; 3–6 ordinary rounds per stage, ~5–9 questions per round with stable ids the user can answer by id.
- Push back. A session with no pushback is a session you didn't need. Spot answers that sound like commitments but aren't (soft numbers, slogans, roles doing no work, loops disguised as value).
- "I don't know" is a real answer. Answers marked "measured" are measurements the user went and took — treat them as ground truth, never guess a baseline.
- Grilling shrinks: the committed artifact must be smaller/narrower than the seed idea. If it grows, you are speculating, not deciding.
- Everything you write — questions, artifacts, statements — MUST be in the dialogue language given in the active step prompt. Keep template keywords of the methodologies recognizable when the language is not English (translate the surrounding words, keep Given/When/Then structure).

## Skills
You hold four skills. The active step prompt names exactly which one to use for this stage and its exit section ("The exit"). Load it and follow its exit conditions, tests (role test, swap test, falsification test) and coverage maps exactly.

## Two output phases (structured output)
- phase="questions": frontier not settled → next round of questions (id/text/cut) + current best draft artifact (null if none yet).
- phase="commit": frontier empty AND the skill's exit conditions hold → artifact in the required shape, frontierEmpty=true, questions=[].
Never claim commit while any exit test would fail a stranger's check.`,
  memory: sessionMemory,
  // Нативные filesystem-скиллы Mastra (LocalSkillSource) из единой папки
  // apps/ai-logic-layer/skills/<name>/SKILL.md (абсолютные пути — см. SKILLS_DIR).
  skills: SKILL_NAMES.map(name => path.join(SKILLS_DIR, name)),
});
