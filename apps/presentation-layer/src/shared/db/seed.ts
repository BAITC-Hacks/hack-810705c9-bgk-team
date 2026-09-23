import { eq } from 'drizzle-orm';
import { getDemoData } from '../../entities/workspace/demo-data';
import { SEED_CARDS, appendixStep4 } from '../../entities/task/model/score.fixtures';
import { fit } from '../../entities/team/model/fit';
import { recalculateScore } from '../../features/task-card/api/recalculate-score';
import { DEMO_BUSINESSES } from '../config/demo-actors';
import { db, type Database } from './index';
import { businesses, tasks, teams, taskField, criterion, grillSession, proposals, stages } from './schema';
import { SEED_TASKS, SEED_TEAMS } from './seed/task-match-seed';

/** Seed both generations of fictional demos without overwriting edited rows.
 * Workspace-v1 text remains archived; group confirmations cannot certify all
 * of the more precise ADR-004 nodes or create structured acceptance criteria.
 */
export async function seedDemoData(database: Database = db) {
  const demo = getDemoData();
  const createdAt = new Date('2026-09-23T08:00:00.000Z');
  const counts = { tasks: 0, teams: 0, proposals: 0 };
  await database.transaction(async tx => {
    await tx.insert(businesses).values([
      ...DEMO_BUSINESSES,
      ...demo.tasks.map(t => ({ id: `business-${t.id}`, name: t.company, industry: t.industry })),
    ]).onConflictDoNothing();
    const insertedTeams = await tx.insert(teams).values([
      ...demo.teams.map(t => ({ ...t, createdAt, updatedAt: createdAt })),
      ...SEED_TEAMS.map(t => ({ id: t.id, name: t.name, roles: t.roles, skills: t.skills, technologies: t.technologies, interests: t.interests, lookingFor: t.lookingFor })),
    ]).onConflictDoNothing().returning({ id: teams.id });
    counts.teams += insertedTeams.length;
    const mapped = { context: 'context.current', need: 'context.change', contact: 'link.contact' } as const;
    for (const t of demo.tasks) {
      const inserted = await tx.insert(tasks).values({
        id: t.id, businessId: `business-${t.id}`, title: t.title, description: t.description,
        company: t.company, topic: t.industry, status: t.status,
        createdAt: new Date(t.createdAt), updatedAt: new Date(t.createdAt),
        publishedAt: t.status === 'published' ? new Date(t.createdAt) : null,
        legacyWorkspace: { schema: 'workspace-v1', task: t,
          fields: Object.entries(t.fields).map(([node,value]) => ({ node, value, state: !value.trim() ? 'empty' : t.confirmedFields.includes(node as keyof typeof t.fields) ? 'confirmed' : 'suggested' })),
          proposals: demo.proposals.filter(p => p.taskId === t.id) },
      }).onConflictDoNothing().returning({ id: tasks.id });
      if (!inserted.length) continue;
      counts.tasks++;
      for (const [group,node] of Object.entries(mapped)) {
        const value = t.fields[group as keyof typeof mapped];
        if (value.trim()) await tx.insert(taskField).values({ taskId: t.id, node, value, state: 'suggested', source: 'manual', sourceQuote: value });
      }
      await tx.insert(grillSession).values({ taskId: t.id, status: t.status === 'draft' ? 'active' : 'finished', draftCheckpointState: 'pending' });
      await recalculateScore(tx, t.id, 'task');
    }
    let insertedCompletedProposal = false;
    for (const p of demo.proposals) {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id,p.taskId));
      const [team] = await tx.select().from(teams).where(eq(teams.id,p.teamId));
      if (!task || !team) continue;
      const accepted = p.status === 'selected' || p.id === 'proposal-school-sreda';
      const inserted = await tx.insert(proposals).values({
        id: p.id, taskId: p.taskId, teamId: p.teamId, solution: p.idea, plan: p.plan,
        deadline: p.timeline, repoUrl: p.prototypeUrl || null, teamRoles: [],
        criteriaAnswers: { criteriaVersion: 1, answers: {} }, fit: fit(team,task).value,
        // Workspace fixtures have no structured criteria. A selected legacy
        // decision is preserved, but no fake canonical stage is manufactured.
        status: accepted ? 'accepted' : p.status === 'rejected' ? 'rejected' : 'submitted',
        acceptedAt: accepted ? createdAt : null,
        kickoff: accepted ? { items: [], firstStage: p.id === 'proposal-school-sreda' ? { criterionId: 'legacy:milestone-school-sreda', metric: 'Прототип карточки прогресса', threshold: '' } : null, contact: null, builtAt: createdAt.toISOString() } : null,
        createdAt, updatedAt: createdAt,
      }).onConflictDoNothing().returning({id:proposals.id});
      counts.proposals += inserted.length;
      if (inserted.length && p.id === 'proposal-school-sreda') insertedCompletedProposal = true;
      if (inserted.length && accepted) await tx.update(tasks).set({status:'in_work'}).where(eq(tasks.id,p.taskId));
    }
    const [completed] = await tx.select().from(proposals).where(eq(proposals.id,'proposal-school-sreda'));
    if (insertedCompletedProposal && completed?.status === 'accepted') await tx.insert(stages).values({
      id: 'milestone-school-sreda', proposalId: completed.id,
      criterionId: 'legacy:milestone-school-sreda', criteriaVersion: 1, position: 0,
      metric: 'Прототип карточки прогресса', threshold: '',
      howToCheck: 'Перенесённый этап workspace-v1; критерий не был структурирован',
      status: 'confirmed', reportUrl: 'https://example.com/demo/student-progress',
      teamComment: 'Демонстрационный результат: карточка и форма проверены на вымышленных данных.',
      points: 10, claimedAt: new Date('2026-09-23T09:00:00.000Z'), confirmedAt: new Date('2026-09-23T09:30:00.000Z'),
    }).onConflictDoNothing();
    for (const [index,t] of SEED_TASKS.entries()) {
      const card = SEED_CARDS.find(c => c.expected === t.score)?.card ?? appendixStep4();
      const inserted = await tx.insert(tasks).values({id:t.id,businessId:DEMO_BUSINESSES[index % DEMO_BUSINESSES.length].id,title:t.title,description:t.title,company:t.company,topic:t.topic,status:t.status,engagement:t.engagement,neededRoles:card.tags.roles.length?t.neededRoles:[],neededSkills:card.tags.skills.length?t.neededSkills:[],tagsState:card.tags.state,publishedAt:t.status==='published'?new Date(t.publishedAt ?? Date.now()):null}).onConflictDoNothing().returning({id:tasks.id});
      if (!inserted.length) continue;
      counts.tasks++;
      for (const [node,field] of Object.entries(card.fields)) {
        if (field) await tx.insert(taskField).values({taskId:t.id,node,value:field.value,state:field.state==='confirmed'?'confirmed':'suggested',notApplicable:field.notApplicable,naNote:field.notApplicable?field.value:null,source:'manual',sourceQuote:field.value,confirmedAt:field.state==='confirmed'?createdAt:null});
      }
      for (const c of card.criteria) await tx.insert(criterion).values({taskId:t.id,position:c.position,metric:c.metric,threshold:c.threshold,thresholdHasNumber:/\d/.test(c.threshold),howToCheck:'Проверить результат на согласованном примере',state:c.state==='confirmed'?'confirmed':'suggested',sourceQuote:`${c.metric}: ${c.threshold}`});
      await tx.insert(grillSession).values({taskId:t.id,status:t.status==='draft'?'active':'finished',draftCheckpointState:'confirmed'});
      await recalculateScore(tx,t.id,'task');
    }
  });
  return counts;
}
