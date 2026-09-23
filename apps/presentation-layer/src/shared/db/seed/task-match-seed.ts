// Seed ADR-006 (раздел 9.3 ТЗ, раздел 12 платформы): команды и задачи с фиксированными id.
// Чистые данные без доступа к БД; скрипт seed вставляет их сам.
import { levelOf } from '@/entities/task/model/level';
import type { TeamProfile } from '@/entities/team/model/types';
import type { TaskTile } from '@/shared/api/contracts/task-match';

export const SEED_TEAM_IDS = {
  botForge: '7e3a0000-0000-4000-8000-000000000001',
  dataBrew: '7e3a0000-0000-4000-8000-000000000002',
  pixelUx: '7e3a0000-0000-4000-8000-000000000003',
  webCraft: '7e3a0000-0000-4000-8000-000000000004',
  qAstra: '7e3a0000-0000-4000-8000-000000000005',
} as const;

export const SEED_TASK_IDS = {
  /** Приложение А: «Бот статусов доставки», рейтинг 77. */
  deliveryBot: '7a5c0000-0000-4000-8000-000000000001',
  attendanceDashboard: '7a5c0000-0000-4000-8000-000000000002',
  repairRequests: '7a5c0000-0000-4000-8000-000000000003',
  purchaseForecast: '7a5c0000-0000-4000-8000-000000000004',
  catalogRedesign: '7a5c0000-0000-4000-8000-000000000005',
  /** T-8: рейтинг 27. */
  warehouseBot: '7a5c0000-0000-4000-8000-000000000006',
  /** T-9: пустые нужные роли. */
  returnsAccounting: '7a5c0000-0000-4000-8000-000000000007',
  /** T-10: подработка, идеально подходит QAstra по ролям, но формат не тот. */
  bookingApiTests: '7a5c0000-0000-4000-8000-000000000008',
  hrBotDraft: '7a5c0000-0000-4000-8000-000000000009',
} as const;

export const SEED_TEAMS: TeamProfile[] = [
  {
    id: SEED_TEAM_IDS.botForge,
    name: 'BotForge',
    roles: ['backend', 'bot'],
    skills: ['Python', 'REST API'],
    // Telegram Bot API только в технологиях: missing должен его учитывать.
    technologies: ['Telegram Bot API', 'aiogram', 'PostgreSQL'],
    interests: ['logistics', 'e-commerce'],
    lookingFor: 'paid',
  },
  {
    id: SEED_TEAM_IDS.dataBrew,
    name: 'DataBrew',
    roles: ['data', 'ml'],
    skills: ['Python', 'SQL', 'Pandas'],
    technologies: ['Jupyter', 'scikit-learn'],
    interests: ['logistics', 'retail', 'education'],
    lookingFor: 'practice',
  },
  {
    id: SEED_TEAM_IDS.pixelUx,
    name: 'PixelUX',
    roles: ['design', 'frontend'],
    skills: ['Figma', 'UX-исследования'],
    technologies: ['React', 'TypeScript'],
    interests: ['e-commerce', 'education'],
    lookingFor: 'both',
  },
  {
    id: SEED_TEAM_IDS.webCraft,
    name: 'WebCraft',
    roles: ['frontend', 'backend'],
    skills: ['TypeScript', 'REST API'],
    technologies: ['React', 'Node.js', 'PostgreSQL'],
    interests: ['manufacturing', 'e-commerce'],
    lookingFor: 'paid',
  },
  {
    id: SEED_TEAM_IDS.qAstra,
    name: 'QAstra',
    roles: ['qa', 'backend'],
    skills: ['Автотесты', 'REST API'],
    technologies: ['Python', 'Playwright', 'Postman'],
    interests: ['education', 'manufacturing'],
    lookingFor: 'practice',
  },
];

type SeedTask = TaskTile & { status: 'draft' | 'published' };

function task(input: Omit<SeedTask, 'level'>): SeedTask {
  return { ...input, level: levelOf(input.score) };
}

// unknown — правдоподобные открытые блоки; в живой системе это score().missing (ADR-005).
export const SEED_TASKS: SeedTask[] = [
  task({
    id: SEED_TASK_IDS.deliveryBot,
    title: 'Бот статусов доставки',
    company: 'ЛогистикаПро',
    topic: 'logistics',
    engagement: 'paid',
    neededRoles: ['backend', 'bot'],
    neededSkills: ['Python', 'REST API', 'Telegram Bot API', 'Docker'],
    score: 77,
    publishedAt: '2026-09-20T09:00:00.000Z',
    unknown: ['стек', 'срок'],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.attendanceDashboard,
    title: 'Дашборд посещаемости',
    company: 'Колледж №5',
    topic: 'education',
    engagement: 'both',
    neededRoles: ['data', 'frontend'],
    neededSkills: ['Python', 'SQL', 'React'],
    score: 91,
    publishedAt: '2026-09-18T09:00:00.000Z',
    unknown: [],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.repairRequests,
    title: 'Сервис заявок на ремонт',
    company: 'ЗаводМет',
    topic: 'manufacturing',
    engagement: 'practice',
    neededRoles: ['backend', 'frontend'],
    neededSkills: ['TypeScript', 'REST API', 'PostgreSQL'],
    score: 76,
    publishedAt: '2026-09-19T09:00:00.000Z',
    unknown: ['данные'],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.purchaseForecast,
    title: 'Прогноз закупок',
    company: 'СетьПлюс',
    topic: 'retail',
    engagement: 'practice',
    neededRoles: ['data', 'ml'],
    neededSkills: ['Python', 'SQL', 'Pandas'],
    score: 58,
    publishedAt: '2026-09-19T12:00:00.000Z',
    unknown: ['результат', 'критерии', 'срок'],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.catalogRedesign,
    title: 'Редизайн каталога',
    company: 'МаркетОнлайн',
    topic: 'e-commerce',
    engagement: 'paid',
    neededRoles: ['design', 'frontend'],
    neededSkills: ['Figma', 'React', 'TypeScript'],
    score: 41,
    publishedAt: '2026-09-21T09:00:00.000Z',
    unknown: ['данные', 'критерии', 'ограничения', 'срок'],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.warehouseBot,
    title: 'Бот записи на склад',
    company: 'СкладЭкспресс',
    topic: 'logistics',
    engagement: 'both',
    neededRoles: ['backend', 'bot'],
    neededSkills: ['Python', 'Telegram Bot API'],
    score: 27,
    publishedAt: '2026-09-21T12:00:00.000Z',
    unknown: ['данные', 'результат', 'критерии', 'стек', 'срок'],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.returnsAccounting,
    title: 'Учёт возвратов',
    company: 'СетьПлюс',
    topic: 'retail',
    engagement: 'both',
    neededRoles: [],
    neededSkills: ['Python', 'SQL'],
    score: 59,
    publishedAt: '2026-09-22T09:00:00.000Z',
    unknown: ['результат', 'стек', 'срок'],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.bookingApiTests,
    title: 'Автотесты API бронирования',
    company: 'УчебныйЦентр',
    topic: 'education',
    engagement: 'paid',
    neededRoles: ['qa', 'backend'],
    neededSkills: ['Автотесты', 'Python', 'Postman'],
    score: 64,
    publishedAt: '2026-09-22T12:00:00.000Z',
    unknown: ['ограничения', 'срок'],
    status: 'published',
  }),
  task({
    id: SEED_TASK_IDS.hrBotDraft,
    title: 'HR-бот для новых сотрудников',
    company: 'ЗаводМет',
    topic: 'manufacturing',
    engagement: 'paid',
    neededRoles: ['backend', 'bot'],
    neededSkills: ['Python', 'Telegram Bot API'],
    score: 72,
    publishedAt: null,
    unknown: ['стек', 'срок'],
    status: 'draft',
  }),
];
