import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks, taskField, criterion, proposals } from '@/shared/db/schema';
import { taskAccess, toExecutorView } from '@/entities/access';
import { getGrill } from '@/features/grill/api/service';
import { getScore } from './get-score';
import { ApiError } from '@/shared/api/errors';
import type { DemoActor } from '@/shared/lib/demo-actor';
export async function readTask(actor: DemoActor, id: string) {
 const [task] = await db.select().from(tasks).where(eq(tasks.id,id));
 if (!task) throw new ApiError(404,'not_found','Задача не найдена');
 const fields = await db.select().from(taskField).where(eq(taskField.taskId,id));
 const responses = await db.select().from(proposals).where(eq(proposals.taskId,id));
 const access = taskAccess(actor,{...task,fields},responses);
 if (!access) throw new ApiError(403,'forbidden','Задача недоступна');
 const criteria = await db.select().from(criterion).where(eq(criterion.taskId,id));
 const owner = access === 'owner';
 return {
  task: owner ? {...task,fields} : toExecutorView({...task,fields}),
  criteria: owner ? criteria : criteria.filter(c=>c.state==='confirmed').map(c=>({id:c.id,position:c.position,metric:c.metric,threshold:c.threshold,howToCheck:c.howToCheck,state:c.state})),
  grill: owner ? await getGrill(id) : null,
  score: owner ? await getScore(id) : null,
  proposals: owner ? responses : responses.filter(p=>actor.role==='team'&&p.teamId===actor.teamId),
 };
}
