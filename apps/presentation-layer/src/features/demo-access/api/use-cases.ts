// ADR-008, п. 2 и 4: use-case принимают `actor` обязательным аргументом и
// проверяют роль и владение на сервере. UI-скрытие кнопок не заменяет эти проверки.
// Порядок: роль → разбор входа → загрузка → владение. Чужая роль получает 403
// даже с невалидным телом.
//
// ИНТЕГРАЦИЯ: минимальные варианты. Полную логику (мэтч, стартовый пакет,
// баллы за этап) даёт ADR-007; при слиянии его use-case вызывают те же
// `assertRole` / `assertTaskOwner` / `assertProposalOwner` в том же порядке.
// `getAiLog` — точка интеграции ADR-003.

import { z } from "zod";

import {
  assertProposalOwner,
  assertRole,
  assertTaskOwner,
  type DemoActor,
} from "@/shared/lib/demo-actor";

import { UseCaseError } from "./errors";
import { parseInput } from "./read-body";
import type {
  AiLogEntry,
  DemoAccessRepository,
  ProposalRecord,
  ProposalStatus,
  StageRecord,
} from "./repository";

/** AI-журнал: только роль `business` и только по своей задаче. */
export async function getAiLog(
  actor: DemoActor,
  taskId: string | null | undefined,
  repo: DemoAccessRepository,
): Promise<AiLogEntry[]> {
  assertRole(actor, "business");
  if (!taskId) throw new UseCaseError("bad_request", "Укажите taskId");
  const task = await loadTask(repo, taskId);
  assertTaskOwner(actor, task);
  return repo.listAiLog(task.id);
}

async function loadTask(repo: DemoAccessRepository, taskId: string) {
  const task = await repo.findTask(taskId);
  if (!task) throw new UseCaseError("not_found", "Задача не найдена");
  return task;
}

async function loadProposal(repo: DemoAccessRepository, proposalId: string) {
  const proposal = await repo.findProposal(proposalId);
  if (!proposal) throw new UseCaseError("not_found", "Отклик не найден");
  return proposal;
}

async function loadStage(repo: DemoAccessRepository, stageId: string) {
  const stage = await repo.findStage(stageId);
  if (!stage) throw new UseCaseError("not_found", "Этап не найден");
  return { stage, proposal: await loadProposal(repo, stage.proposalId) };
}

export const decisionInputSchema = z.object({
  action: z.enum(["accept", "reject", "on_hold", "submitted"]),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type DecisionInput = z.infer<typeof decisionInputSchema>;

const DECISION_TARGET: Record<DecisionInput["action"], ProposalStatus> = {
  accept: "accepted",
  reject: "rejected",
  on_hold: "on_hold",
  submitted: "submitted",
};

const isDecided = (status: ProposalStatus) => status === "accepted" || status === "rejected";

/** Раздел 9.2: `submitted ↔ on_hold → accepted / rejected`; меняет только бизнес-владелец. */
export async function decideProposal(
  actor: DemoActor,
  proposalId: string,
  rawInput: unknown,
  repo: DemoAccessRepository,
): Promise<ProposalRecord> {
  assertRole(actor, "business");
  const input = parseInput(decisionInputSchema, rawInput);
  const proposal = await loadProposal(repo, proposalId);
  assertTaskOwner(actor, await loadTask(repo, proposal.taskId));

  const status = DECISION_TARGET[input.action];
  if (isDecided(proposal.status) || proposal.status === status) {
    throw new UseCaseError("conflict", "Недопустимый переход статуса отклика");
  }
  return repo.saveProposal({
    ...proposal,
    status,
    rejectReason: input.action === "reject" ? (input.reason ?? null) : null,
  });
}

export const proposalUpdateSchema = z
  .object({
    solution: z.string().trim().min(1).max(4000).optional(),
    plan: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((value) => value.solution !== undefined || value.plan !== undefined, {
    message: "Нечего обновлять",
  });
export type ProposalUpdateInput = z.infer<typeof proposalUpdateSchema>;

/** FR-6.4: команда-автор правит отклик до решения бизнеса. */
export async function updateProposal(
  actor: DemoActor,
  proposalId: string,
  rawInput: unknown,
  repo: DemoAccessRepository,
): Promise<ProposalRecord> {
  assertRole(actor, "team");
  const input = parseInput(proposalUpdateSchema, rawInput);
  const proposal = await loadProposal(repo, proposalId);
  assertProposalOwner(actor, proposal);
  if (isDecided(proposal.status)) {
    throw new UseCaseError("conflict", "По отклику уже принято решение");
  }
  return repo.saveProposal({ ...proposal, ...input });
}

export const claimInputSchema = z.object({
  reportUrl: z.url().optional(),
});
export type ClaimInput = z.infer<typeof claimInputSchema>;

/** Раздел 9.2: `open → claimed`, `returned → claimed`; сдаёт только команда-автор отклика. */
export async function claimStage(
  actor: DemoActor,
  stageId: string,
  rawInput: unknown,
  repo: DemoAccessRepository,
): Promise<StageRecord> {
  assertRole(actor, "team");
  const input = parseInput(claimInputSchema, rawInput);
  const { stage, proposal } = await loadStage(repo, stageId);
  assertProposalOwner(actor, proposal);

  if (stage.status !== "open" && stage.status !== "returned") {
    throw new UseCaseError("conflict", "Этап уже сдан или подтверждён");
  }
  return repo.saveStage({
    ...stage,
    status: "claimed",
    reportUrl: input.reportUrl ?? stage.reportUrl,
  });
}

export const stageReviewSchema = z.object({
  comment: z.string().trim().min(1).max(2000).optional(),
});
export type StageReviewInput = z.infer<typeof stageReviewSchema>;

/** `claimed → confirmed | returned`; решает бизнес-владелец задачи (этап → отклик → задача). */
async function reviewStage(
  status: "confirmed" | "returned",
  actor: DemoActor,
  stageId: string,
  rawInput: unknown,
  repo: DemoAccessRepository,
): Promise<StageRecord> {
  assertRole(actor, "business");
  const input = parseInput(stageReviewSchema, rawInput);
  const { stage, proposal } = await loadStage(repo, stageId);
  assertTaskOwner(actor, await loadTask(repo, proposal.taskId));

  if (stage.status !== "claimed") {
    throw new UseCaseError("conflict", "Этап ещё не сдан командой");
  }
  return repo.saveStage({
    ...stage,
    status,
    businessComment: input.comment ?? stage.businessComment,
  });
}

export const confirmStage = reviewStage.bind(null, "confirmed");
export const returnStage = reviewStage.bind(null, "returned");
