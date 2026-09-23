// ADR-008: демо-участники без регистрации. Список задаёт допустимые значения cookie `tm_actor`.
//
// Допущение (открытый вопрос ADR-008): один демо-бизнес на каждую seed-карточку
// (раздел 9.3 ТЗ: логистика, производство, образование, ритейл, e-commerce). Так
// на демо видна проверка «чужая задача → 403» между бизнесами.
//
// ИНТЕГРАЦИЯ: id команд совпадают с SEED_TEAM_IDS из ветки ADR-006
// (`src/shared/db/seed/task-match-seed.ts`). id бизнесов должны совпасть с
// `business.id` в seed ADR-004/007; при расхождении правится только этот файл.

export type DemoBusiness = { id: string; name: string; industry: string };
export type DemoTeam = { id: string; name: string };

export const DEMO_BUSINESSES: readonly DemoBusiness[] = [
  { id: "7b150000-0000-4000-8000-000000000001", name: "ЛогистикаПро", industry: "логистика" },
  { id: "7b150000-0000-4000-8000-000000000002", name: "ЗаводТех", industry: "производство" },
  { id: "7b150000-0000-4000-8000-000000000003", name: "УчиЛегко", industry: "образование" },
  { id: "7b150000-0000-4000-8000-000000000004", name: "МаркетДом", industry: "ритейл" },
  { id: "7b150000-0000-4000-8000-000000000005", name: "ШопОнлайн", industry: "e-commerce" },
];

export const DEMO_TEAMS: readonly DemoTeam[] = [
  { id: "7e3a0000-0000-4000-8000-000000000001", name: "BotForge" },
  { id: "7e3a0000-0000-4000-8000-000000000002", name: "DataBrew" },
  { id: "7e3a0000-0000-4000-8000-000000000003", name: "PixelUX" },
  { id: "7e3a0000-0000-4000-8000-000000000004", name: "WebCraft" },
  { id: "7e3a0000-0000-4000-8000-000000000005", name: "QAstra" },
];

export const [DEFAULT_DEMO_BUSINESS] = DEMO_BUSINESSES;
export const [DEFAULT_DEMO_TEAM] = DEMO_TEAMS;
