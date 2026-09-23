import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/shared/db';
import { proposals, proposalStages, taskFields, tasks } from '@/shared/db/schema';
import { buildKickoffPacket, type Card, type NodeKey } from '@/entities/task-match';
import { ApiError } from './http';

type ProposalRow = typeof proposals.$inferSelect;

function projectProposal(row: ProposalRow, milestoneConfirmed = false) {
  return { id: row.id, taskId: row.taskId, teamId: row.teamId, idea: row.idea,
    plan: row.plan, timeline: row.timeline, prototypeUrl: row.prototypeUrl ?? '',
    status: row.status === 'accepted' ? 'selected' : row.status === 'rejected' ? 'rejected' : 'pending',
    milestoneConfirmed };
}

export async function allProposals() {
  const rows = await db.select().from(proposals).orderBy(desc(proposals.createdAt));
  const stages = await db.select().from(proposalStages);
  return rows.map((row) => projectProposal(row, stages.some((stage) => stage.proposalId === row.id && stage.status === 'confirmed')));
}

export async function taskProposals(taskId: string) {
  const rows = await db.select().from(proposals).where(eq(proposals.taskId, taskId)).orderBy(desc(proposals.fit), desc(proposals.createdAt));
  const stages = await db.select().from(proposalStages);
  return { proposals: rows.map((row) => projectProposal(row, stages.some((stage) => stage.proposalId === row.id && stage.status === 'confirmed'))) };
}

const applySchema = z.object({
  teamId: z.string().min(1), idea: z.string().trim().min(1), plan: z.string().trim().min(1),
  timeline: z.string().trim().min(1), prototypeUrl: z.union([z.url(), z.literal('')]).optional(),
});

export async function applyToTask(taskId: string, input: unknown) {
  const parsed = applySchema.parse(input);
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new ApiError(404, 'NOT_FOUND', 'Задача не найдена');
  if (task.status !== 'published') throw new ApiError(409, 'NOT_PUBLISHED', 'Задача ещё не опубликована');
  const [existing] = await db.select().from(proposals).where(and(eq(proposals.taskId, taskId), eq(proposals.teamId, parsed.teamId))).limit(1);
  if (existing && existing.status !== 'submitted') throw new ApiError(409, 'ALREADY_DECIDED', 'Решение по отклику уже принято');
  const [row] = existing
    ? await db.update(proposals).set({ idea: parsed.idea, plan: parsed.plan, timeline: parsed.timeline, prototypeUrl: parsed.prototypeUrl || null }).where(eq(proposals.id, existing.id)).returning()
    : await db.insert(proposals).values({ taskId, teamId: parsed.teamId, idea: parsed.idea, plan: parsed.plan, timeline: parsed.timeline, prototypeUrl: parsed.prototypeUrl || null }).returning();
  return { proposal: projectProposal(row) };
}

const decisionSchema = z.object({
  decision: z.enum(['select', 'reject', 'defer']),
  reason: z.string().trim().optional(),
});

export async function decideProposal(proposalId: string, input: unknown) {
  const { decision, reason } = decisionSchema.parse(input);
  if (decision === 'reject' && !reason) throw new ApiError(422, 'REASON_REQUIRED', 'Укажите причину отклонения');
  const [existing] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Отклик не найден');
  if (existing.status !== 'submitted') throw new ApiError(409, 'ALREADY_DECIDED', 'Решение уже принято');
  if (decision === 'defer') return { proposal: projectProposal(existing) };
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.update(proposals).set({ status: decision === 'select' ? 'accepted' : 'rejected', rejectReason: reason ?? null,
      decidedAt: new Date() }).where(and(eq(proposals.id, proposalId), eq(proposals.status, 'submitted'))).returning();
    if (!row) throw new ApiError(409, 'ALREADY_DECIDED', 'Решение уже принято');
    if (decision === 'select') {
      const [criterion] = await tx.select().from(taskFields).where(and(eq(taskFields.taskId, row.taskId), eq(taskFields.key, 'criteria.items'))).limit(1);
      const items = criterion?.state === 'confirmed' ? criterion.value.split(/\n|;/).map((item) => item.trim()).filter(Boolean).slice(0, 3) : [];
      await tx.insert(proposalStages).values((items.length ? items : ['Первый результат по задаче']).map((item) => ({ proposalId, criterion: item })));
    }
    return row;
  });
  return { proposal: projectProposal(result), stages: decision === 'select' ? await db.select().from(proposalStages).where(eq(proposalStages.proposalId, proposalId)) : [] };
}

export async function kickoff(proposalId: string) {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal || proposal.status !== 'accepted') throw new ApiError(404, 'NOT_FOUND', 'Мэтч не найден');
  const [task] = await db.select().from(tasks).where(eq(tasks.id, proposal.taskId)).limit(1);
  const fields = await db.select().from(taskFields).where(eq(taskFields.taskId, proposal.taskId));
  const card: Card = { fields: {}, engagement: task?.engagement as Card['engagement'] };
  for (const field of fields) card.fields[field.key as NodeKey] = { value: field.value, state: field.state as 'empty' | 'suggested' | 'confirmed' };
  return { proposal: projectProposal(proposal), packet: buildKickoffPacket(card), stages: await db.select().from(proposalStages).where(eq(proposalStages.proposalId, proposalId)) };
}

export async function claimStage(stageId: string, input: unknown) {
  const { evidenceUrl } = z.object({ evidenceUrl: z.url(), comment: z.string().optional() }).parse(input);
  const [stage] = await db.update(proposalStages).set({ evidenceUrl, status: 'claimed', updatedAt: new Date() })
    .where(and(eq(proposalStages.id, stageId), eq(proposalStages.status, 'open'))).returning();
  if (!stage) throw new ApiError(409, 'INVALID_STATE', 'Этап нельзя сдать');
  return { stage };
}

export async function confirmStage(stageId: string) {
  const [stage] = await db.update(proposalStages).set({ status: 'confirmed', points: 10, updatedAt: new Date() })
    .where(and(eq(proposalStages.id, stageId), eq(proposalStages.status, 'claimed'))).returning();
  if (!stage) throw new ApiError(409, 'INVALID_STATE', 'Сначала команда должна сдать этап');
  return { stage };
}

export async function confirmFirstMilestone(proposalId: string, input: unknown) {
  const { evidenceUrl } = z.object({ evidenceUrl: z.url() }).parse(input);
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal || proposal.status !== 'accepted') throw new ApiError(404, 'NOT_FOUND', 'Мэтч не найден');
  const [stage] = await db.select().from(proposalStages).where(eq(proposalStages.proposalId, proposalId)).orderBy(proposalStages.createdAt).limit(1);
  if (!stage) throw new ApiError(404, 'NOT_FOUND', 'Этап не найден');
  if (stage.status === 'confirmed') return { proposal: projectProposal(proposal, true), stage };
  const [updated] = await db.update(proposalStages).set({ evidenceUrl, status: 'confirmed', points: 10, updatedAt: new Date() })
    .where(and(eq(proposalStages.id, stage.id), eq(proposalStages.status, 'open'))).returning();
  if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Этап нельзя подтвердить');
  return { proposal: projectProposal(proposal, true), stage: updated };
}
