import type { Engagement } from '@/shared/api/contracts/task-match';

/** Профиль команды для fit() (FR-5.1). Роли — slug из ROLE_LABELS. */
export type TeamProfile = {
  id: string;
  name: string;
  roles: string[];
  skills: string[];
  technologies: string[];
  interests: string[];
  lookingFor: Engagement;
};

/** Поля задачи, которые читает fit(). */
export type FitTask = {
  topic: string;
  neededRoles: string[];
  neededSkills: string[];
};

/** Справочник ролей slug → подпись (открытый вопрос ADR-006 о slug). */
export const ROLE_LABELS: Record<string, string> = {
  backend: 'backend',
  frontend: 'frontend',
  bot: 'бот-разработчик',
  data: 'аналитик данных',
  ml: 'ML-инженер',
  design: 'дизайнер',
  qa: 'QA',
};
