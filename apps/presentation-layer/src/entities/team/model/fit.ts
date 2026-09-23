// ADR-006: совпадение команды и задачи (раздел 6.4 ТЗ, FR-5.2, FR-5.5).
import type { FitResult } from '@/shared/api/contracts/task-match';

import { ROLE_LABELS, type FitTask, type TeamProfile } from './types';

const normalize = (value: string) => value.trim().toLowerCase();

/** Делит нужное на «есть» и «не хватает», сохраняя написание и порядок задачи. */
function split(need: string[], have: string[]) {
  const pool = new Set(have.map(normalize));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const item of need) {
    (pool.has(normalize(item)) ? matched : missing).push(item);
  }
  return { matched, missing };
}

const share = (matched: string[], need: string[]) =>
  need.length ? matched.length / need.length : 0;

export function fit(
  team: Pick<TeamProfile, 'roles' | 'skills' | 'technologies' | 'interests'>,
  task: FitTask,
): FitResult {
  const roles = split(task.neededRoles, team.roles);
  // missing считается по тому же множеству, что и value (исправление примера 6.2).
  const skills = split(task.neededSkills, [
    ...team.skills,
    ...team.technologies,
  ]);
  const topicMatch = team.interests
    .map(normalize)
    .includes(normalize(task.topic));

  const raw =
    0.5 * share(roles.matched, task.neededRoles) +
    0.3 * share(skills.matched, task.neededSkills) +
    0.2 * (topicMatch ? 1 : 0);
  const value = Math.min(1, Math.max(0, Math.round(raw * 10_000) / 10_000));

  return {
    value,
    matchedRoles: roles.matched,
    missingRoles: roles.missing,
    matchedSkills: skills.matched,
    missingSkills: skills.missing,
    topicMatch,
  };
}

const roleLabel = (slug: string) => ROLE_LABELS[normalize(slug)] ?? slug;

const joinRu = (items: string[]) =>
  items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;

/**
 * Процент совпадения с банковским округлением: эталон ТЗ требует 0.925 → 92 %
 * и 0.275 → 28 %, чего Math.round не даёт (92.5 → 93).
 */
export function fitPercent(value: number): number {
  const scaled = Math.round(value * 100 * 1e6) / 1e6;
  const floor = Math.floor(scaled);
  if (scaled - floor !== 0.5) return Math.round(scaled);
  return floor % 2 === 0 ? floor : floor + 1;
}

/** «92%: роли backend и бот-разработчик есть; Python, REST API есть; не хватает: Docker». */
export function formatFitExplanation(f: FitResult): string {
  const parts: string[] = [];
  if (f.matchedRoles.length) {
    const noun = f.matchedRoles.length === 1 ? 'роль' : 'роли';
    parts.push(`${noun} ${joinRu(f.matchedRoles.map(roleLabel))} есть`);
  }
  if (f.matchedSkills.length) parts.push(`${f.matchedSkills.join(', ')} есть`);
  if (f.topicMatch) parts.push('тема в интересах команды');

  const missing = [...f.missingRoles.map(roleLabel), ...f.missingSkills];
  if (missing.length) parts.push(`не хватает: ${missing.join(', ')}`);

  const percent = `${fitPercent(f.value)}%`;
  return parts.length ? `${percent}: ${parts.join('; ')}` : percent;
}
