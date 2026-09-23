import { desc, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { proposals, stages } from '@/shared/db/schema';
export function projectProposal(row: typeof proposals.$inferSelect, milestoneConfirmed = false) {
  return { id: row.id, taskId: row.taskId, teamId: row.teamId, idea: row.solution,
    plan: row.plan, timeline: row.deadline, prototypeUrl: row.repoUrl ?? '',
    status: row.status === 'accepted' ? 'selected' : row.status === 'rejected' ? 'rejected' : 'pending', milestoneConfirmed };
}
export async function allProposals() {
  const rows = await db.select().from(proposals).orderBy(desc(proposals.createdAt));
  const confirmed = await db.select().from(stages).where(eq(stages.status, 'confirmed'));
  return rows.map(row => projectProposal(row, confirmed.some(s => s.proposalId === row.id)));
}
