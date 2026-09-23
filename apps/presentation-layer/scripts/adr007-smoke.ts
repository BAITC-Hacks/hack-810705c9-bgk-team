// ADR-007 smoke test: seeds a SCRATCH database, drives the route handlers
// over HTTP against a `next dev` instance bound to that database, and
// asserts the acceptance scenarios from ADR-007 / ADR-009 (T-16..T-18).
//
// Run with: node scripts/adr007-smoke.ts   (Node type-stripping; no deps beyond pg + fetch)
// Requires: DATABASE_URL_NEXTJS pointing at a scratch database (never the shared one).

import { Client } from "pg";
import { randomUUID } from "node:crypto";

const BASE = "http://localhost:3107";

// Ответы API проверяются точечно по полям; строгий тип здесь не несёт пользы
// для одноразового прогонного скрипта.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

let passed = 0;
let failed = 0;

function assert(cond: boolean, message: string) {
  if (cond) {
    passed++;
    console.log(`  ok  ${message}`);
  } else {
    failed++;
    console.log(`FAIL  ${message}`);
  }
}

function cookieHeader(role: "business" | "team", actorId: string) {
  return `tm_role=${role}; tm_actor=${actorId}`;
}

async function call(
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: Json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL_NEXTJS });
  await db.connect();

  const businessId = randomUUID();
  const taskId = randomUUID();
  const task2Id = randomUUID();
  const botForgeId = randomUUID();
  const dataBrewId = randomUUID();
  const criterion1Id = randomUUID();
  const criterion2Id = randomUUID();
  const criterionTask2Id = randomUUID();

  console.log("Seeding scratch database...");
  await db.query(`insert into business (id, name, industry) values ($1, $2, $3)`, [
    businessId,
    "Logistics Co",
    "logistics",
  ]);

  await db.query(
    `insert into task (id, business_id, title, topic, status, engagement, compensation_note, needed_roles, needed_skills, criteria_version)
     values ($1,$2,$3,$4,'published','job',$5,$6,$7,1)`,
    [
      taskId,
      businessId,
      "Аналитика конверсии",
      "analytics",
      "оплата за каждый принятый этап",
      ["backend"],
      ["sql"],
    ],
  );
  await db.query(
    `insert into task (id, business_id, title, topic, status, engagement, compensation_note, needed_roles, needed_skills, criteria_version)
     values ($1,$2,$3,$4,'published','job',$5,$6,$7,1)`,
    [task2Id, businessId, "Второй проект", "analytics", "оплата после сдачи", ["backend"], ["sql"]],
  );

  const confirmedFields: [string, string][] = [
    ["data.sample", "выборка 1000 заказов за квартал"],
    ["constraints.stack", "Python, dbt"],
    ["link.cadence", "созвон по вторникам 15:00"],
    ["constraints.deadline", "через 6 недель"],
    ["link.contact", "it@logistics.example"],
  ];
  for (const [node, value] of confirmedFields) {
    await db.query(
      `insert into field (task_id, node, value, state, not_applicable) values ($1,$2,$3,'confirmed',false)`,
      [taskId, node, value],
    );
  }

  await db.query(
    `insert into criterion (id, task_id, position, metric, threshold, how_to_check, version, confirmed)
     values ($1,$2,0,'конверсия','>=60%','смотрим отчёт по заказам',1,true)`,
    [criterion1Id, taskId],
  );
  await db.query(
    `insert into criterion (id, task_id, position, metric, threshold, how_to_check, version, confirmed)
     values ($1,$2,1,'время ответа','<3 с','нагрузочный тест',1,true)`,
    [criterion2Id, taskId],
  );
  await db.query(
    `insert into criterion (id, task_id, position, metric, threshold, how_to_check, version, confirmed)
     values ($1,$2,0,'полнота отчёта','100%','ручная проверка',1,true)`,
    [criterionTask2Id, task2Id],
  );

  await db.query(
    `insert into team (id, name, roles, skills, technologies, interests) values ($1,$2,$3,$4,$5,$6)`,
    [botForgeId, "BotForge", ["backend"], ["sql"], [], ["analytics"]],
  );
  await db.query(
    `insert into team (id, name, roles, skills, technologies, interests) values ($1,$2,$3,$4,$5,$6)`,
    [dataBrewId, "DataBrew", ["data"], ["python"], [], []],
  );

  const business = cookieHeader("business", businessId);
  const botForge = cookieHeader("team", botForgeId);
  const dataBrew = cookieHeader("team", dataBrewId);

  const proposalPayload = (extra: Record<string, string> = {}) => ({
    solution: "Соберём дашборд конверсии",
    plan: "1. Выгрузка данных 2. Расчёт метрик 3. Дашборд",
    teamRoles: ["backend", "analyst"],
    deadline: "через 4 недели",
    criteriaAnswers: {
      [criterion1Id]: "посчитаем через SQL-отчёт",
      [criterion2Id]: "замерим нагрузочным тестом",
      ...extra,
    },
  });

  console.log("\n--- Submit proposals ---");
  const submit1 = await call("POST", `/api/tasks/${taskId}/proposals`, botForge, proposalPayload());
  assert(submit1.status === 201, `BotForge submits proposal -> 201 (got ${submit1.status})`);
  const botForgeProposalId = submit1.json?.id;

  const dupSubmit = await call("POST", `/api/tasks/${taskId}/proposals`, botForge, proposalPayload());
  assert(dupSubmit.status === 409, `Duplicate active proposal -> 409 (got ${dupSubmit.status})`);

  const submit2 = await call("POST", `/api/tasks/${taskId}/proposals`, dataBrew, proposalPayload());
  assert(submit2.status === 201, `DataBrew submits proposal -> 201 (got ${submit2.status})`);
  const dataBrewProposalId = submit2.json?.id;

  console.log("\n--- Decision validation (T-16) ---");
  const rejectNoReason = await call("POST", `/api/proposals/${botForgeProposalId}/decision`, business, {
    action: "reject",
  });
  assert(rejectNoReason.status === 422, `Reject without reason -> 422 (got ${rejectNoReason.status})`);

  const rejectOtherNoNote = await call("POST", `/api/proposals/${botForgeProposalId}/decision`, business, {
    action: "reject",
    reason: "other",
  });
  assert(rejectOtherNoNote.status === 422, `Reject reason=other without note -> 422 (got ${rejectOtherNoNote.status})`);

  console.log("\n--- on_hold <-> submitted ---");
  const toHold = await call("POST", `/api/proposals/${botForgeProposalId}/decision`, business, { action: "on_hold" });
  assert(toHold.status === 200, `submitted -> on_hold ok (got ${toHold.status})`);
  const backSubmitted = await call("POST", `/api/proposals/${botForgeProposalId}/decision`, business, {
    action: "submitted",
  });
  assert(backSubmitted.status === 200, `on_hold -> submitted ok (got ${backSubmitted.status})`);

  console.log("\n--- T-18: accept two teams ---");
  const acceptBotForge = await call("POST", `/api/proposals/${botForgeProposalId}/decision`, business, {
    action: "accept",
  });
  assert(acceptBotForge.status === 200, `Accept BotForge -> 200 (got ${acceptBotForge.status})`);
  assert(acceptBotForge.json?.proposal?.status === "accepted", "BotForge proposal status = accepted");
  assert(Array.isArray(acceptBotForge.json?.stages) && acceptBotForge.json.stages.length === 2, "BotForge got 2 stages");

  const acceptDataBrew = await call("POST", `/api/proposals/${dataBrewProposalId}/decision`, business, {
    action: "accept",
  });
  assert(acceptDataBrew.status === 200, `Accept DataBrew -> 200 (got ${acceptDataBrew.status})`);
  assert(acceptDataBrew.json?.proposal?.status === "accepted", "DataBrew proposal status = accepted");
  assert(Array.isArray(acceptDataBrew.json?.stages) && acceptDataBrew.json.stages.length === 2, "DataBrew got 2 stages");

  const { rows: taskRows } = await db.query(`select status from task where id = $1`, [taskId]);
  assert(taskRows[0]?.status === "in_work", `Task in_work after accept (got ${taskRows[0]?.status})`);

  const botForgeKickoff = await call("GET", `/api/proposals/${botForgeProposalId}/kickoff`, business, undefined);
  const dataBrewKickoff = await call("GET", `/api/proposals/${dataBrewProposalId}/kickoff`, business, undefined);
  assert(botForgeKickoff.status === 200 && !!botForgeKickoff.json?.kickoff, "BotForge kickoff present");
  assert(dataBrewKickoff.status === 200 && !!dataBrewKickoff.json?.kickoff, "DataBrew kickoff present");
  assert(botForgeKickoff.json?.stages?.length === 2 && dataBrewKickoff.json?.stages?.length === 2, "2x2 stages with snapshots");

  console.log("\n--- Editing a criterion afterwards doesn't change stage text ---");
  const stageBefore = botForgeKickoff.json.stages[0];
  await db.query(`update criterion set metric = 'ИЗМЕНЁННЫЙ' , version = 2 where id = $1`, [criterion1Id]);
  const stagesAfterEdit = await call("GET", `/api/proposals/${botForgeProposalId}/stages`, business, undefined);
  const stageAfter = stagesAfterEdit.json.find((s: Json) => s.id === stageBefore.id);
  assert(stageAfter?.metric === stageBefore.metric, "Stage metric snapshot unchanged after criterion edit");

  console.log("\n--- Stage lifecycle ---");
  const botForgeStages = await call("GET", `/api/proposals/${botForgeProposalId}/stages`, business, undefined);
  const firstStageId = botForgeStages.json[0].id;

  const wrongTeamClaim = await call("POST", `/api/stages/${firstStageId}/claim`, dataBrew, {
    reportUrl: "https://example.com/report",
    comment: "готово",
  });
  assert(wrongTeamClaim.status === 403, `Claim by wrong team -> 403 (got ${wrongTeamClaim.status})`);

  const claim1 = await call("POST", `/api/stages/${firstStageId}/claim`, botForge, {
    reportUrl: "https://example.com/report",
    comment: "отчёт готов",
  });
  assert(claim1.status === 200, `Claim -> 200 (got ${claim1.status})`);

  const returnNoComment = await call("POST", `/api/stages/${firstStageId}/return`, business, {});
  assert(returnNoComment.status === 422, `Return without comment -> 422 (got ${returnNoComment.status})`);

  const returned = await call("POST", `/api/stages/${firstStageId}/return`, business, {
    comment: "нужно уточнить методику",
  });
  assert(returned.status === 200, `Return -> 200 (got ${returned.status})`);

  const claim2 = await call("POST", `/api/stages/${firstStageId}/claim`, botForge, {
    reportUrl: "https://example.com/report-2",
    comment: "уточнили методику",
  });
  assert(claim2.status === 200, `Re-claim -> 200 (got ${claim2.status})`);

  const confirm1 = await call("POST", `/api/stages/${firstStageId}/confirm`, business, {});
  assert(confirm1.status === 200, `Confirm -> 200 (got ${confirm1.status})`);
  assert(confirm1.json?.points === 10, `Confirm sets points=10 (got ${confirm1.json?.points})`);

  const progress1 = await call("GET", `/api/teams/${botForgeId}/progress`, business, undefined);
  assert(progress1.json?.points === 10, `Team progress points = 10 (got ${progress1.json?.points})`);

  const confirm2 = await call("POST", `/api/stages/${firstStageId}/confirm`, business, {});
  assert(confirm2.status === 409, `Second confirm -> 409 (got ${confirm2.status})`);

  const progress2 = await call("GET", `/api/teams/${botForgeId}/progress`, business, undefined);
  assert(progress2.json?.points === 10, `Team points still 10 after repeat confirm (got ${progress2.json?.points})`);
  assert(progress2.json?.portfolio?.length === 1, "Team portfolio has one confirmed entry");

  console.log("\n--- T-17: close task without accepted proposals ---");
  const submitTask2 = await call("POST", `/api/tasks/${task2Id}/proposals`, dataBrew, {
    solution: "Решение",
    plan: "План",
    teamRoles: ["data"],
    deadline: "через 3 недели",
    criteriaAnswers: { [criterionTask2Id]: "проверим вручную" },
  });
  assert(submitTask2.status === 201, `DataBrew submits to task2 -> 201 (got ${submitTask2.status})`);

  const closeTask2 = await call("POST", `/api/tasks/${task2Id}/close`, business, undefined);
  assert(closeTask2.status === 200, `Close task2 -> 200 (got ${closeTask2.status})`);
  assert(closeTask2.json?.rejectedCount === 1, `Close task2 rejects 1 pending proposal (got ${closeTask2.json?.rejectedCount})`);

  const { rows: task2ProposalRows } = await db.query(
    `select status, reject_reason from proposal where task_id = $1`,
    [task2Id],
  );
  assert(
    task2ProposalRows[0]?.status === "rejected" && task2ProposalRows[0]?.reject_reason === "task_closed",
    "task2 proposal rejected with reject_reason=task_closed",
  );

  console.log("\n--- Close task with accepted proposal -> 409 ---");
  const closeTaskWithAccepted = await call("POST", `/api/tasks/${taskId}/close`, business, undefined);
  assert(closeTaskWithAccepted.status === 409, `Close task with accepted -> 409 (got ${closeTaskWithAccepted.status})`);

  console.log("\n--- Proposal to closed task -> 409 ---");
  const submitToClosed = await call("POST", `/api/tasks/${task2Id}/proposals`, botForge, {
    solution: "Решение",
    plan: "План",
    teamRoles: ["data"],
    deadline: "через 3 недели",
    criteriaAnswers: { [criterionTask2Id]: "проверим вручную" },
  });
  assert(submitToClosed.status === 409, `Submit to closed task -> 409 (got ${submitToClosed.status})`);

  console.log("\n--- Accept on a closed task -> 409 ---");
  const task3Id = randomUUID();
  const criterionTask3Id = randomUUID();
  await db.query(
    `insert into task (id, business_id, title, topic, status, engagement, compensation_note, needed_roles, needed_skills, criteria_version)
     values ($1,$2,$3,$4,'published','job',$5,$6,$7,1)`,
    [task3Id, businessId, "Третий проект", "analytics", "оплата после сдачи", ["backend"], ["sql"]],
  );
  await db.query(
    `insert into criterion (id, task_id, position, metric, threshold, how_to_check, version, confirmed)
     values ($1,$2,0,'полнота отчёта','100%','ручная проверка',1,true)`,
    [criterionTask3Id, task3Id],
  );
  const submitTask3 = await call("POST", `/api/tasks/${task3Id}/proposals`, botForge, {
    solution: "Решение",
    plan: "План",
    teamRoles: ["backend"],
    deadline: "через 3 недели",
    criteriaAnswers: { [criterionTask3Id]: "проверим вручную" },
  });
  assert(submitTask3.status === 201, `BotForge submits to task3 -> 201 (got ${submitTask3.status})`);
  const task3ProposalId = submitTask3.json?.id;
  // Закрываем задачу в обход эндпоинта, оставляя отклик submitted, чтобы
  // проверить именно 409 из decideProposal при accept на закрытой задаче.
  await db.query(`update task set status = 'closed' where id = $1`, [task3Id]);
  const acceptOnClosedTask = await call("POST", `/api/proposals/${task3ProposalId}/decision`, business, {
    action: "accept",
  });
  assert(acceptOnClosedTask.status === 409, `Accept on closed task -> 409 (got ${acceptOnClosedTask.status})`);

  await db.end();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
