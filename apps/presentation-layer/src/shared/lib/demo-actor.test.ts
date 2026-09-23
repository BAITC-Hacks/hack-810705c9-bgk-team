import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEMO_BUSINESSES, DEMO_TEAMS } from "@/shared/config/demo-actors";

import {
  DEFAULT_DEMO_ACTOR,
  ForbiddenError,
  assertProposalOwner,
  assertRole,
  assertTaskOwner,
  forbiddenResponse,
  parseDemoActor,
  parseDemoView,
  requireDemoActorFrom,
  resolveDemoActor,
  type DemoActor,
} from "./demo-actor";

const [bizA, bizB] = DEMO_BUSINESSES;
const [botForge, dataBrew] = DEMO_TEAMS;
const business: DemoActor = { role: "business", businessId: bizA.id };
const team: DemoActor = { role: "team", teamId: botForge.id };

describe("parseDemoActor", () => {
  it("по умолчанию — первый демо-бизнес", () => {
    assert.deepEqual(parseDemoActor({}), DEFAULT_DEMO_ACTOR);
    assert.deepEqual(DEFAULT_DEMO_ACTOR, { role: "business", businessId: bizA.id });
  });

  it("принимает пары из seed-списка", () => {
    assert.deepEqual(parseDemoActor({ role: "business", actor: bizB.id }), {
      role: "business",
      businessId: bizB.id,
    });
    assert.deepEqual(parseDemoActor({ role: "team", actor: dataBrew.id }), {
      role: "team",
      teamId: dataBrew.id,
    });
  });

  it("не пускает id команды под ролью бизнеса и наоборот", () => {
    assert.deepEqual(parseDemoActor({ role: "business", actor: botForge.id }), DEFAULT_DEMO_ACTOR);
    assert.deepEqual(parseDemoActor({ role: "team", actor: bizA.id }), {
      role: "team",
      teamId: botForge.id,
    });
  });

  it("неизвестная роль → бизнес по умолчанию", () => {
    assert.deepEqual(parseDemoActor({ role: "admin", actor: bizB.id }), DEFAULT_DEMO_ACTOR);
  });
});

describe("строгий разбор для API", () => {
  it("resolveDemoActor: null без cookie, с неизвестной ролью или устаревшим id", () => {
    assert.equal(resolveDemoActor({}), null);
    assert.equal(resolveDemoActor({ role: "admin", actor: bizA.id }), null);
    assert.equal(resolveDemoActor({ role: "team", actor: "stale-team-id" }), null);
    assert.equal(resolveDemoActor({ role: "team", actor: bizA.id }), null);
    assert.deepEqual(resolveDemoActor({ role: "team", actor: dataBrew.id }), {
      role: "team",
      teamId: dataBrew.id,
    });
  });

  it("requireDemoActorFrom: без cookie → 403 «Выберите демо-роль»", async () => {
    let error: unknown;
    try {
      requireDemoActorFrom({});
    } catch (caught) {
      error = caught;
    }
    const response = forbiddenResponse(error);
    assert.equal(response?.status, 403);
    assert.deepEqual(await response?.json(), {
      error: { code: "forbidden", message: "Выберите демо-роль" },
    });
  });

  it("requireDemoActorFrom: устаревший id команды → 403, а не BotForge", () => {
    assert.throws(
      () => requireDemoActorFrom({ role: "team", actor: "stale-team-id" }),
      ForbiddenError,
    );
  });
});

describe("parseDemoView", () => {
  it("принимает deck|grid, иначе deck", () => {
    assert.equal(parseDemoView("grid"), "grid");
    assert.equal(parseDemoView("list"), "deck");
    assert.equal(parseDemoView(undefined), "deck");
  });
});

describe("проверки владения", () => {
  it("assertRole пропускает свою роль и бросает 403 на чужую", () => {
    assert.doesNotThrow(() => assertRole(business, "business"));
    assert.throws(() => assertRole(team, "business"), ForbiddenError);
    assert.throws(() => assertRole(business, "team"), ForbiddenError);
  });

  it("assertTaskOwner: только бизнес-владелец задачи", () => {
    assert.doesNotThrow(() => assertTaskOwner(business, { businessId: bizA.id }));
    assert.throws(() => assertTaskOwner(business, { businessId: bizB.id }), ForbiddenError);
    assert.throws(() => assertTaskOwner(team, { businessId: bizA.id }), ForbiddenError);
  });

  it("assertProposalOwner: только команда-автор отклика", () => {
    assert.doesNotThrow(() => assertProposalOwner(team, { teamId: botForge.id }));
    assert.throws(() => assertProposalOwner(team, { teamId: dataBrew.id }), ForbiddenError);
    assert.throws(() => assertProposalOwner(business, { teamId: botForge.id }), ForbiddenError);
  });
});

describe("forbiddenResponse", () => {
  it("ForbiddenError → 403 JSON в формате ADR-009", async () => {
    const response = forbiddenResponse(new ForbiddenError("нет"));
    assert.ok(response);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: { code: "forbidden", message: "нет" } });
  });

  it("прочие ошибки не превращает в 403", () => {
    assert.equal(forbiddenResponse(new Error("boom")), null);
  });
});
