import { fit } from '@/entities/team';
// FR-5.2, раздел 6.4: совпадение считается кодом, не AI.
// ADR-006 владеет каноническим fit(); ADR-007 использует этот тонкий адаптер
// с порядком аргументов своего use-case.

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
