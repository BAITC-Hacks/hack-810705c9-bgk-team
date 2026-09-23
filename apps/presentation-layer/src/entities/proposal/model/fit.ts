import { fit } from '@/entities/team';
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

export function computeFit(task: FitTask, team: FitTeam): number { return fit(team, task).value; }
