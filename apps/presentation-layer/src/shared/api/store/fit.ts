import type { InternalTask, InternalTeam } from './domain';

/**
 * INTEGRATION(ADR-006): fit(team, task), раздел 6.4 ТЗ.
 * `missing*` считается по тому же множеству skills ∪ technologies, что и
 * `value` (исправление явной ошибки примера в платформе, отмеченное в
 * ADR-006 §Контекст). Владелец ADR-006 переносит эту функцию в
 * `src/entities/team/model/fit.ts` и подключает `topic` задачи к
 * `team.interests`.
 */
export function fit(team: InternalTeam, task: InternalTask) {
  const teamSkillsAndTech = new Set([...team.skills, ...team.technologies]);
  const matchedRoles = task.neededRoles.filter((role) => team.roles.includes(role));
  const missingRoles = task.neededRoles.filter((role) => !team.roles.includes(role));
  const matchedSkills = task.neededSkills.filter((skill) => teamSkillsAndTech.has(skill));
  const missingSkills = task.neededSkills.filter((skill) => !teamSkillsAndTech.has(skill));
  const topicMatch = team.interests.includes(task.topic);

  const roleShare = task.neededRoles.length ? matchedRoles.length / task.neededRoles.length : 0;
  const skillShare = task.neededSkills.length ? matchedSkills.length / task.neededSkills.length : 0;

  const value = 0.5 * roleShare + 0.3 * skillShare + 0.2 * (topicMatch ? 1 : 0);

  return { value, matchedRoles, missingRoles, matchedSkills, missingSkills, topicMatch };
}

export function formatMatches(teamLooksFor: InternalTeam['looksFor'], taskFormat: InternalTask['format']): boolean {
  if (teamLooksFor === 'both') return true;
  return taskFormat === 'both' || taskFormat === teamLooksFor;
}
