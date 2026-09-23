import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { DEMO_BUSINESSES, DEMO_TEAMS } from "@/shared/config/demo-actors";
import { ForbiddenError, type DemoActor } from "@/shared/lib/demo-actor";

import { UseCaseError, toErrorResponse } from "./errors";
import { STUB_IDS, createStubRepository, type DemoAccessRepository } from "./repository";
import { INVALID_JSON } from "./read-body";
import {
  claimStage,
  confirmStage,
  decideProposal,
  getAiLog,
  returnStage,
  updateProposal,
} from "./use-cases";

const [bizLogistics, bizFactory] = DEMO_BUSINESSES;
const [botForge, dataBrew] = DEMO_TEAMS;
const owner: DemoActor = { role: "business", businessId: bizLogistics.id };
const otherBusiness: DemoActor = { role: "business", businessId: bizFactory.id };
const teamBot: DemoActor = { role: "team", teamId: botForge.id };
const teamData: DemoActor = { role: "team", teamId: dataBrew.id };

let repo: DemoAccessRepository;
beforeEach(() => {
  repo = createStubRepository();
});

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    return toErrorResponse(error).status;
  }
}

describe("GET /api/ai-log: getAiLog", () => {
  it("владелец задачи получает журнал", async () => {
    const log = await getAiLog(owner, STUB_IDS.task, repo);
    assert.equal(log.length, 1);
    assert.equal(log[0].taskId, STUB_IDS.task);
  });

  it("роль team → 403", async () => {
    await assert.rejects(getAiLog(teamBot, STUB_IDS.task, repo), ForbiddenError);
    assert.equal(await statusOf(getAiLog(teamBot, STUB_IDS.task, repo)), 403);
  });

  it("чужой бизнес → 403", async () => {
    assert.equal(await statusOf(getAiLog(otherBusiness, STUB_IDS.task, repo)), 403);
  });

  it("без taskId → 400, неизвестная задача → 404", async () => {
    assert.equal(await statusOf(getAiLog(owner, null, repo)), 400);
    assert.equal(await statusOf(getAiLog(owner, "missing", repo)), 404);
  });
});

describe("POST /api/proposals/:id/decision: decideProposal", () => {
  it("бизнес-владелец выбирает отклик", async () => {
    const proposal = await decideProposal(owner, STUB_IDS.proposalPixelUx, { action: "accept" }, repo);
    assert.equal(proposal.status, "accepted");
  });

  it("отклонение сохраняет причину", async () => {
    const proposal = await decideProposal(
      owner,
      STUB_IDS.proposalPixelUx,
      { action: "reject", reason: "Нет опыта с ботами" },
      repo,
    );
    assert.equal(proposal.status, "rejected");
    assert.equal(proposal.rejectReason, "Нет опыта с ботами");
  });

  it("роль team → 403, даже автор отклика", async () => {
    assert.equal(
      await statusOf(decideProposal(teamBot, STUB_IDS.proposalPixelUx, { action: "accept" }, repo)),
      403,
    );
  });

  it("роль team с невалидным телом → 403, а не 400", async () => {
    assert.equal(await statusOf(decideProposal(teamBot, STUB_IDS.proposalPixelUx, INVALID_JSON, repo)), 403);
    assert.equal(await statusOf(decideProposal(teamBot, STUB_IDS.proposalPixelUx, { action: "x" }, repo)), 403);
    assert.equal(await statusOf(decideProposal(owner, STUB_IDS.proposalPixelUx, INVALID_JSON, repo)), 400);
    assert.equal(await statusOf(decideProposal(owner, STUB_IDS.proposalPixelUx, { action: "x" }, repo)), 400);
  });

  it("чужой бизнес → 403, статус не меняется", async () => {
    assert.equal(
      await statusOf(decideProposal(otherBusiness, STUB_IDS.proposalPixelUx, { action: "accept" }, repo)),
      403,
    );
    assert.equal((await repo.findProposal(STUB_IDS.proposalPixelUx))?.status, "submitted");
  });

  it("решение по уже выбранному отклику → 409, неизвестный отклик → 404", async () => {
    await assert.rejects(
      decideProposal(owner, STUB_IDS.proposalBotForge, { action: "reject" }, repo),
      UseCaseError,
    );
    assert.equal(await statusOf(decideProposal(owner, "missing", { action: "accept" }, repo)), 404);
  });
});

describe("POST /api/stages/:id/claim: claimStage", () => {
  it("команда-автор сдаёт свой этап", async () => {
    const stage = await claimStage(
      teamBot,
      STUB_IDS.stageBotForge,
      { reportUrl: "https://example.com/report" },
      repo,
    );
    assert.equal(stage.status, "claimed");
    assert.equal(stage.reportUrl, "https://example.com/report");
  });

  it("команда A сдаёт этап команды B → 403", async () => {
    assert.equal(await statusOf(claimStage(teamData, STUB_IDS.stageBotForge, {}, repo)), 403);
    assert.equal((await repo.findStage(STUB_IDS.stageBotForge))?.status, "open");
  });

  it("бизнес → 403, повторная сдача → 409", async () => {
    assert.equal(await statusOf(claimStage(owner, STUB_IDS.stageBotForge, {}, repo)), 403);
    await claimStage(teamBot, STUB_IDS.stageBotForge, {}, repo);
    assert.equal(await statusOf(claimStage(teamBot, STUB_IDS.stageBotForge, {}, repo)), 409);
  });
});

describe("updateProposal", () => {
  const pixelUx: DemoActor = { role: "team", teamId: DEMO_TEAMS[2].id };

  it("команда-автор правит отклик до решения", async () => {
    const proposal = await updateProposal(pixelUx, STUB_IDS.proposalPixelUx, { plan: "Новый план" }, repo);
    assert.equal(proposal.plan, "Новый план");
  });

  it("другая команда → 403, бизнес → 403", async () => {
    assert.equal(await statusOf(updateProposal(teamBot, STUB_IDS.proposalPixelUx, { plan: "x" }, repo)), 403);
    assert.equal(await statusOf(updateProposal(owner, STUB_IDS.proposalPixelUx, { plan: "x" }, repo)), 403);
    assert.equal((await repo.findProposal(STUB_IDS.proposalPixelUx))?.plan, "Прототип за 2 недели");
  });

  it("после решения бизнеса → 409", async () => {
    assert.equal(await statusOf(updateProposal(teamBot, STUB_IDS.proposalBotForge, { plan: "x" }, repo)), 409);
  });
});

describe("confirmStage / returnStage", () => {
  it("бизнес-владелец подтверждает сданный этап", async () => {
    const stage = await confirmStage(owner, STUB_IDS.stageBotForgeClaimed, {}, repo);
    assert.equal(stage.status, "confirmed");
  });

  it("бизнес-владелец возвращает этап с комментарием", async () => {
    const stage = await returnStage(owner, STUB_IDS.stageBotForgeClaimed, { comment: "Нет отчёта" }, repo);
    assert.equal(stage.status, "returned");
    assert.equal(stage.businessComment, "Нет отчёта");
  });

  it("чужой бизнес → 403, команда (даже автор) → 403", async () => {
    for (const review of [confirmStage, returnStage]) {
      assert.equal(await statusOf(review(otherBusiness, STUB_IDS.stageBotForgeClaimed, {}, repo)), 403);
      assert.equal(await statusOf(review(teamBot, STUB_IDS.stageBotForgeClaimed, {}, repo)), 403);
      assert.equal(await statusOf(review(teamData, STUB_IDS.stageBotForgeClaimed, {}, repo)), 403);
    }
    assert.equal((await repo.findStage(STUB_IDS.stageBotForgeClaimed))?.status, "claimed");
  });

  it("несданный этап → 409", async () => {
    assert.equal(await statusOf(confirmStage(owner, STUB_IDS.stageBotForge, {}, repo)), 409);
  });
});
