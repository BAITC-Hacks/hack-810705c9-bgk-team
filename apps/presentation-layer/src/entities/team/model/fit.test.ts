import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SEED_TASK_IDS,
  SEED_TASKS,
  SEED_TEAMS,
} from '@/shared/db/seed/task-match-seed';

import { fit, fitPercent, formatFitExplanation } from './fit';

const team = (name: string) => SEED_TEAMS.find((t) => t.name === name)!;
const deliveryBot = SEED_TASKS.find((t) => t.id === SEED_TASK_IDS.deliveryBot)!;

describe('fit()', () => {
  it('BotForge на эталоне даёт 0.925 → 92 % и не хватает только Docker', () => {
    const result = fit(team('BotForge'), deliveryBot);
    assert.equal(result.value, 0.925);
    assert.equal(fitPercent(result.value), 92);
    assert.deepEqual(result.matchedRoles, ['backend', 'bot']);
    assert.deepEqual(result.missingRoles, []);
    assert.deepEqual(result.matchedSkills, [
      'Python',
      'REST API',
      'Telegram Bot API',
    ]);
    assert.deepEqual(result.missingSkills, ['Docker']);
    assert.equal(result.topicMatch, true);

    const text = formatFitExplanation(result);
    assert.match(text, /^92%: /);
    assert.match(text, /бот-разработчик/);
    assert.match(text, /не хватает: Docker$/);
  });

  it('DataBrew на эталоне даёт 0.275 → 28 %', () => {
    const result = fit(team('DataBrew'), deliveryBot);
    assert.equal(result.value, 0.275);
    assert.equal(fitPercent(result.value), 28);
    assert.match(formatFitExplanation(result), /^28%/);
  });

  it('навык из технологий команды не попадает в «не хватает»', () => {
    const botForge = team('BotForge');
    assert.ok(!botForge.skills.includes('Telegram Bot API'));
    assert.ok(botForge.technologies.includes('Telegram Bot API'));
    const result = fit(botForge, deliveryBot);
    assert.ok(!result.missingSkills.includes('Telegram Bot API'));
  });

  it('пустые нужные роли дают долю ролей 0', () => {
    const result = fit(
      { roles: ['backend'], skills: ['Python'], technologies: [], interests: [] },
      { topic: 'retail', neededRoles: [], neededSkills: ['Python'] },
    );
    assert.equal(result.value, 0.3);
    assert.deepEqual(result.matchedRoles, []);
  });

  it('сравнивает без учёта регистра и пробелов, сохраняя написание задачи', () => {
    const result = fit(
      {
        roles: ['Backend '],
        skills: ['python'],
        technologies: [' docker'],
        interests: ['LOGISTICS'],
      },
      {
        topic: 'logistics',
        neededRoles: ['backend'],
        neededSkills: ['Python', 'Docker', 'Kafka'],
      },
    );
    assert.equal(result.value, 0.9);
    assert.deepEqual(result.matchedSkills, ['Python', 'Docker']);
    assert.deepEqual(result.missingSkills, ['Kafka']);
    assert.equal(result.topicMatch, true);
  });

  it('fitPercent округляет половину к чётному', () => {
    assert.equal(fitPercent(0.925), 92);
    assert.equal(fitPercent(0.275), 28);
    assert.equal(fitPercent(0.655), 66);
    assert.equal(fitPercent(0.5), 50);
    assert.equal(fitPercent(0.551), 55);
  });

  it('объяснение без совпадений не ломается', () => {
    const result = fit(
      { roles: [], skills: [], technologies: [], interests: [] },
      { topic: 'x', neededRoles: [], neededSkills: [] },
    );
    assert.equal(formatFitExplanation(result), '0%');
  });
});
