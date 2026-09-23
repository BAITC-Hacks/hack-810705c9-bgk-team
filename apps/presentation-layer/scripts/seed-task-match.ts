import { eq, sql } from 'drizzle-orm';
import { db } from '../src/shared/db';
import { businesses, tasks, teams, taskField, criterion, grillSession } from '../src/shared/db/schema';
import { SEED_TASKS, SEED_TEAMS } from '../src/shared/db/seed/task-match-seed';
import { DEMO_BUSINESSES } from '../src/shared/config/demo-actors';
import { SEED_CARDS, appendixStep4 } from '../src/entities/task/model/score.fixtures';
import { recalculateScore } from '../src/features/task-card/api/recalculate-score';

async function main() {
 await db.insert(businesses).values(DEMO_BUSINESSES.map(b => ({ ...b }))).onConflictDoNothing();
 await db.insert(teams).values(SEED_TEAMS.map(t => ({id:t.id,name:t.name,roles:t.roles,skills:t.skills,technologies:t.technologies,interests:t.interests,lookingFor:t.lookingFor}))).onConflictDoNothing();
 for (const [index, t] of SEED_TASKS.entries()) {
  await db.transaction(async tx => {
   const [existing] = await tx.select().from(tasks).where(eq(tasks.id,t.id));
   if (existing) return; // Preserve edited demo data on subsequent runs.
   const card = SEED_CARDS.find(c => c.expected === t.score)?.card ?? appendixStep4();
   await tx.insert(tasks).values({id:t.id,businessId:DEMO_BUSINESSES[index % DEMO_BUSINESSES.length].id,title:t.title,description:t.title,company:t.company,topic:t.topic,status:t.status,engagement:t.engagement,neededRoles:card.tags.roles.length?t.neededRoles:[],neededSkills:card.tags.skills.length?t.neededSkills:[],tagsState:card.tags.state,publishedAt:t.status==='published'?new Date(t.publishedAt ?? Date.now()):null});
   for (const [node, field] of Object.entries(card.fields)) {
    if (!field) continue;
    await tx.insert(taskField).values({taskId:t.id,node,value:field.value,state:field.state==='confirmed'?'confirmed':'suggested',notApplicable:field.notApplicable,naNote:field.notApplicable?field.value:null,source:'manual',sourceQuote:field.value,confirmedAt:field.state==='confirmed'?new Date():null});
   }
   for (const c of card.criteria) await tx.insert(criterion).values({taskId:t.id,position:c.position,metric:c.metric,threshold:c.threshold,thresholdHasNumber:/\d/.test(c.threshold),howToCheck:'Проверить результат на согласованном примере',state:c.state==='confirmed'?'confirmed':'suggested',sourceQuote:`${c.metric}: ${c.threshold}`});
   await tx.insert(grillSession).values({taskId:t.id,status:t.status==='draft'?'active':'finished',draftCheckpointState:'confirmed'});
   await recalculateScore(tx,t.id,'task');
  });
 }
 const result = await db.select({id:tasks.id,score:tasks.score}).from(tasks);
 console.log(`Seed: ${SEED_TEAMS.length} teams, ${result.length} tasks; scores calculated from fields.`);
 await db.execute(sql`select 1`);
 process.exit(0);
}
main().catch(() => { console.error('Seed failed'); process.exit(1); });
