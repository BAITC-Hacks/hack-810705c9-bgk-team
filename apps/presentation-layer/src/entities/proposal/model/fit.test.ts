import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeFit } from "./fit";

// Приложение А: «Совпадение: BotForge — 92%, первая в колоде; DataBrew — 28%,
// только каталог». Формула (раздел 6.4) с фракциями по 2 ролям / 4 навыкам не
// даёт точно 0.5+0.3+0.2 без округления до чистых 92%; ниже — набор входных
// данных, дающий близкое высокое совпадение (роли и тема совпали полностью,
// три из четырёх навыков), и явно низкое для DataBrew.

const task = {
  neededRoles: ["backend", "бот-разработчик"],
  neededSkills: ["Python", "REST API", "Telegram Bot API", "Docker"],
  topic: "Логистика",
};

describe("computeFit", () => {
  it("высокое совпадение при полных ролях, теме и почти всех навыках", () => {
    const team = {
      roles: ["backend", "Бот-разработчик"],
      skills: ["python", "docker"],
      technologies: ["REST API", "Telegram Bot API"],
      interests: ["логистика"],
    };
    // roleShare=1 (0.5) + skillShare=1 (0.3) + topic=1 (0.2) = 1.0
    assert.equal(computeFit(task, team), 1);
  });

  it("низкое совпадение (DataBrew): нет ролей и навыков, другая тема", () => {
    const team = {
      roles: ["data-analyst"],
      skills: ["SQL"],
      technologies: ["Airflow"],
      interests: ["маркетинг"],
    };
    const fit = computeFit(task, team);
    assert.ok(fit < 0.3);
  });

  it("регистр не влияет на совпадение", () => {
    const team = {
      roles: ["BACKEND"],
      skills: [],
      technologies: [],
      interests: [],
    };
    const withUpper = computeFit(task, team);
    const withLower = computeFit(task, { ...team, roles: ["backend"] });
    assert.equal(withUpper, withLower);
  });

  it("пустой список нужного не даёт искусственных 100% доли", () => {
    const fit = computeFit(
      { neededRoles: [], neededSkills: [], topic: "" },
      { roles: [], skills: [], technologies: [], interests: [] },
    );
    assert.equal(fit, 0);
  });

  it("результат сохраняет точность канонического fit ADR-006", () => {
    const team = {
      roles: ["backend", "бот-разработчик"],
      skills: ["Python", "REST API", "Telegram Bot API"],
      technologies: [],
      interests: ["Логистика"],
    };
    const fit = computeFit(task, team);
    assert.ok(fit >= 0 && fit <= 1);
    assert.equal(fit, 0.925);
  });
});
