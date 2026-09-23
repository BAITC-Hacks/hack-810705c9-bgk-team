// FR-5.2, раздел 6.4: совпадение считается кодом, не AI.
// ADR-006 владеет каноническим fit(); это локальная копия по той же формуле
// для ADR-007 (сравнение откликов), которую нужно свести с ADR-006 при слиянии.

export type FitTask = {
  neededRoles: string[];
  neededSkills: string[];
  topic: string;
};

export type FitTeam = {
  roles: string[];
  skills: string[];
  technologies: string[];
  interests: string[];
};

function toLowerSet(values: string[]): Set<string> {
  return new Set(values.map((v) => v.toLowerCase()));
}

function shareOf(needed: string[], available: Set<string>): number {
  // Пустой список нужного не даёт доли (0), а не 1 — задача без ролей/навыков
  // не должна получать искусственно высокий fit.
  if (needed.length === 0) return 0;
  const matched = needed.filter((item) => available.has(item.toLowerCase())).length;
  return matched / needed.length;
}

export function computeFit(task: FitTask, team: FitTeam): number {
  const teamRoles = toLowerSet(team.roles);
  const teamSkills = toLowerSet([...team.skills, ...team.technologies]);

  const roleShare = shareOf(task.neededRoles, teamRoles);
  const skillShare = shareOf(task.neededSkills, teamSkills);
  const topicMatch = team.interests.some(
    (interest) => interest.toLowerCase() === task.topic.toLowerCase(),
  )
    ? 1
    : 0;

  const fit = 0.5 * roleShare + 0.3 * skillShare + 0.2 * topicMatch;
  const clamped = Math.min(1, Math.max(0, fit));
  return Math.round(clamped * 100) / 100;
}
