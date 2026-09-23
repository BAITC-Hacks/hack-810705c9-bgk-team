import assert from 'node:assert/strict';
import { appendixDraft, appendixStep1, appendixStep2, appendixStep3, appendixStep4 } from '../src/entities/task/model/score.fixtures';
import { DEMO_BUSINESSES, DEMO_TEAMS } from '../src/shared/config/demo-actors';
const base = process.env.INTEGRATION_BASE_URL ?? 'http://localhost:3217';
const business = `tm_role=business; tm_actor=${DEMO_BUSINESSES[0].id}`;
const team = (i=0)=>`tm_role=team; tm_actor=${DEMO_TEAMS[i].id}`;
let checks=0;
async function api(path:string, method='GET', body?:unknown, cookie=business, expected=200) {
 const r=await fetch(base+path,{method,headers:{'content-type':'application/json',cookie},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
 const data=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);checks++;return data;
}
await api('/api/tasks','POST',{description:'short'},business,422);
await api('/api/tasks','POST','{',business,400);
const created=await api('/api/tasks','POST',{description:'Операторы отвечают клиентам о статусе заказа, нужен бот для уведомлений.'},business,201);
const id=created.task.id;
assert.equal(created.fallbackUsed,true);assert.equal(created.next.kind,'checkpoint');
await api(`/api/tasks/${id}/grill/checkpoint`,'POST',{block:'draft',action:'confirm',sessionVersion:0});
await api(`/api/tasks/${id}/grill/turn`,'POST',{answer:'Сейчас отвечают вручную',sessionVersion:0},business,409);
const previous:Record<string,string>={};
for(const [fixture,total] of [[appendixDraft(),24],[appendixStep1(),44],[appendixStep2(),59],[appendixStep3(),74],[appendixStep4(),77]] as const) {
 for(const [node,field] of Object.entries(fixture.fields)) {
  if(!field || previous[node]===field.value)continue;
  let d=await api(`/api/tasks/${id}`);
  await api(`/api/tasks/${id}/fields/${node}`,'PATCH',{action:'edit',value:field.value,sessionVersion:d.grill.session.version});
  d=await api(`/api/tasks/${id}`);
  await api(`/api/tasks/${id}/fields/${node}`,'PATCH',{action:'confirm',sessionVersion:d.grill.session.version});
  previous[node]=field.value;
 }
 if(fixture.criteria.length) {
  let d=await api(`/api/tasks/${id}`);
  await api(`/api/tasks/${id}/fields/criteria.items`,'PATCH',{action:'edit',value:fixture.criteria.map(c=>({...c,howToCheck:'Проверить тестовым прогоном'})),sessionVersion:d.grill.session.version});
  d=await api(`/api/tasks/${id}`);
  await api(`/api/tasks/${id}/fields/criteria.items`,'PATCH',{action:'confirm',sessionVersion:d.grill.session.version});
 }
 if(fixture.tags.state==='confirmed') await api(`/api/tasks/${id}`,'PATCH',{neededRoles:fixture.tags.roles,neededSkills:fixture.tags.skills,tagsState:'confirmed',engagement:'both',topic:'logistics'});
 const score=await api(`/api/tasks/${id}/score`);assert.equal(score.total,total);assert.equal((await api(`/api/tasks/${id}`)).task.score,total);
 console.log(`rating ${total}: persisted and explained`);
}
let d=await api(`/api/tasks/${id}`);
await api(`/api/tasks/${id}/fields/context.current`,'PATCH',{action:'edit',value:'Процесс изменён вручную',sessionVersion:d.grill.session.version});
assert.equal((await api(`/api/tasks/${id}/score`)).total,72);
d=await api(`/api/tasks/${id}`);
await api(`/api/tasks/${id}/fields/context.current`,'PATCH',{action:'confirm',sessionVersion:d.grill.session.version});
await api(`/api/tasks/${id}`,'PATCH',{engagement:'practice'});assert.equal((await api(`/api/tasks/${id}/score`)).total,77);
await api(`/api/tasks/${id}`,'PATCH',{engagement:'both',neededRoles:['backend','bot'],tagsState:'confirmed'});
await api(`/api/tasks/${id}/publish`,'POST',{});
await api(`/api/tasks/${id}/fields/context.current`,'PATCH',{action:'edit',value:'Чужая правка',sessionVersion:0},team(),403);
await api(`/api/ai-log?taskId=${id}`,'GET',undefined,team(),403);
await api(`/api/ai-log?taskId=${id}`,'GET',undefined,`tm_role=business; tm_actor=${DEMO_BUSINESSES[1].id}`,403);
const catalog=await api('/api/catalog');assert.ok(JSON.stringify(catalog).includes(id));
const before=await api(`/api/teams/${DEMO_TEAMS[0].id}/recommendations`,'GET',undefined,team());
assert.ok(before.items.some((i:{task:{id:string}})=>i.task.id===id));
await api('/api/swipes','POST',{teamId:DEMO_TEAMS[0].id,taskId:id,action:'skip'},team(),201);
const after=await api(`/api/teams/${DEMO_TEAMS[0].id}/recommendations`,'GET',undefined,team());assert.ok(!after.items.some((i:{task:{id:string}})=>i.task.id===id));assert.equal((await api(`/api/tasks/${id}/score`)).total,77);
assert.ok(JSON.stringify(await api('/api/catalog')).includes(id));
console.log(`recommendations: ${before.items.length} → ${after.items.length}; catalog and rating preserved`);
const accepted=[];
const submitted: string[]=[];
for(const i of [0,1]) {
 const detail=await api(`/api/tasks/${id}`,'GET',undefined,team(i));
 const proposal=await api(`/api/tasks/${id}/proposals`,'POST',{solution:'Создадим бот',plan:'Прототип, проверка, запуск',deadline:'4 недели',teamRoles:['backend'],criteriaAnswers:Object.fromEntries(detail.criteria.map((c:{id:string})=>[c.id,'Проверим тестовым прогоном']))},team(i),201);
 const pid=proposal.id??proposal.proposal?.id;assert.ok(pid,JSON.stringify(proposal));
 await api(`/api/proposals/${pid}/decision`,'POST',{action:'reject'},business,422);
 await api(`/api/proposals/${pid}/decision`,'POST',{action:'accept'},team(i),403);
 submitted.push(pid);
}
for (const [i,pid] of submitted.entries()) {
 await api(`/api/proposals/${pid}/decision`,'POST',{action:'accept'});
 const kickoff=await api(`/api/proposals/${pid}/kickoff`,'GET',undefined,team(i));assert.ok(kickoff.kickoff);
 const stages=await api(`/api/proposals/${pid}/stages`,'GET',undefined,team(i));assert.ok(stages.length);accepted.push({pid,stages,kickoff});
}
const stage=accepted[0].stages[0];
await api(`/api/stages/${stage.id}/claim`,'POST',{reportUrl:'https://example.com/result',comment:'Готово'},team(1),403);
await api(`/api/stages/${stage.id}/claim`,'POST',{reportUrl:'https://example.com/result',comment:'Готово'},team());
await api(`/api/stages/${stage.id}/return`,'POST',{comment:'Добавьте проверку'});
await api(`/api/stages/${stage.id}/claim`,'POST',{reportUrl:'https://example.com/result',comment:'Проверка добавлена'},team());
await api(`/api/stages/${stage.id}/confirm`,'POST',{});
await api(`/api/stages/${stage.id}/confirm`,'POST',{},business,409);
const progress=await api(`/api/teams/${DEMO_TEAMS[0].id}/progress`);assert.ok(JSON.stringify(progress).includes('10'));
await api(`/api/tasks/${id}/close`,'POST',{},business,409);
console.log(`PASS: ${checks} HTTP assertions; real Postgres, AI_ENABLED=false. Task ${id}`);
