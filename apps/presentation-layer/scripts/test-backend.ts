/**
 * Explicit live integration check. Start the app and migrate its PostgreSQL DB first.
 * Run from this app: bun scripts/test-backend.ts
 * TEST_BASE_URL defaults to http://localhost:3000. DATABASE_URL_NEXTJS enables
 * automatic cleanup of only the task/team IDs created by this run.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type {
  Proposal,
  Task,
  TaskField,
  Team,
  WorkspaceData,
} from "../src/entities/workspace/model";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const runName = `Backend integration ${randomUUID()}`;
const taskIds: string[] = [];
const teamIds: string[] = [];
type SavedTask = Task & { version: number };
type Workspace = WorkspaceData & {
  session: { role: "business" | "student"; teamId: string | null };
};
type Assessment = {
  score: number;
  level: "draft" | "working" | "ready" | "priority";
  verdict: string;
  breakdown: {
    criterion: string;
    max: number;
    awarded: number;
    justification: string;
  }[];
  missing: string[];
  recalculation: {
    firstEvaluation: boolean;
    previousScore: number | null;
    delta: number | null;
    closedItems: string[];
  };
};

class ApiClient {
  private cookies = new Map<string, string>();

  constructor(private readonly serverUrl = baseUrl) {}

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { rawBody?: string; contentType?: string; origin?: string } = {},
  ): Promise<{ status: number; body: T }> {
    const headers = new Headers({
      Origin: options.origin ?? new URL(this.serverUrl).origin,
    });
    if (this.cookies.size) {
      headers.set("Cookie", [...this.cookies.values()].join("; "));
    }
    if (body !== undefined || options.rawBody !== undefined) {
      headers.set("Content-Type", options.contentType ?? "application/json");
    }
    const response = await fetch(new URL(path, this.serverUrl), {
      method,
      headers,
      body:
        options.rawBody ??
        (body === undefined ? undefined : JSON.stringify(body)),
      signal: AbortSignal.timeout(60_000),
      redirect: "error",
    });
    for (const header of response.headers.getSetCookie()) {
      const value = header.split(";", 1)[0];
      this.cookies.set(value.slice(0, value.indexOf("=")), value);
      assert.match(header, /httponly/i, "Session cookies must be HTTP-only");
    }
    const text = await response.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        `${method} ${path}: expected JSON, received ${response.status}: ${text.slice(0, 180)}`,
      );
    }
    return { status: response.status, body: result as T };
  }

  async ok<T>(method: string, path: string, body?: unknown): Promise<T> {
    const result = await this.request<T>(method, path, body);
    assert.ok(
      result.status >= 200 && result.status < 300,
      `${method} ${path}: expected success, received ${result.status}: ${JSON.stringify(result.body)}`,
    );
    return result.body;
  }

  async fails(method: string, path: string, body: unknown, statuses: number[]) {
    const result = await this.request<unknown>(method, path, body);
    assert.ok(
      statuses.includes(result.status),
      `${method} ${path}: expected ${statuses.join("/")}, received ${result.status}`,
    );
  }
}

function validateAssessment(value: Assessment) {
  assert.deepEqual(
    Object.keys(value).sort(),
    [
      "score",
      "level",
      "verdict",
      "breakdown",
      "missing",
      "recalculation",
    ].sort(),
  );
  assert.ok(
    Number.isInteger(value.score) && value.score >= 0 && value.score <= 100,
  );
  assert.ok(["draft", "working", "ready", "priority"].includes(value.level));
  assert.ok(value.verdict.trim().length > 0);
  assert.deepEqual(
    value.breakdown.map(({ criterion, max }) => [criterion, max]),
    [
      ["context_and_need", 20],
      ["data_and_materials", 20],
      ["expected_result", 15],
      ["success_criteria", 15],
      ["constraints", 10],
      ["users", 10],
      ["business_connection", 10],
    ],
  );
  for (const row of value.breakdown) {
    assert.deepEqual(
      Object.keys(row).sort(),
      ["criterion", "max", "awarded", "justification"].sort(),
    );
    assert.ok(
      Number.isInteger(row.awarded) &&
        row.awarded >= 0 &&
        row.awarded <= row.max,
    );
    assert.ok(row.justification.trim().length > 0);
  }
  assert.equal(
    value.score,
    value.breakdown.reduce((sum, row) => sum + row.awarded, 0),
  );
  assert.ok(
    value.missing.every(
      (question) => typeof question === "string" && question.trim().length > 0,
    ),
  );
  assert.deepEqual(
    Object.keys(value.recalculation).sort(),
    ["firstEvaluation", "previousScore", "delta", "closedItems"].sort(),
  );
  assert.equal(typeof value.recalculation.firstEvaluation, "boolean");
  assert.ok(Array.isArray(value.recalculation.closedItems));
  if (value.recalculation.firstEvaluation) {
    assert.equal(value.recalculation.previousScore, null);
    assert.equal(value.recalculation.delta, null);
  } else {
    assert.ok(Number.isInteger(value.recalculation.previousScore));
    assert.equal(
      value.recalculation.delta,
      value.score - value.recalculation.previousScore!,
    );
  }
}

function teamFixture(suffix: string): Team {
  return {
    id: randomUUID(),
    name: `${runName} ${suffix}`,
    initials: suffix,
    tagline: "A temporary team for the live backend integration check",
    skills: ["TypeScript", "PostgreSQL"],
    interests: ["Логистика"],
    members: 3,
    color: "#2563eb",
  };
}

async function cleanup() {
  if (!taskIds.length && !teamIds.length) return;
  if (!process.env.DATABASE_URL_NEXTJS) {
    console.warn(
      `DATABASE_URL_NEXTJS is unset; created test records remain: ${JSON.stringify({ taskIds, teamIds })}`,
    );
    return;
  }
  // UUIDs are collected only from successful creates in this run. The extra
  // description/name guard prevents accidentally deleting an existing demo row.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_NEXTJS });
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const deletedTasks = await connection.query<{ business_id: string }>(
      "DELETE FROM tasks WHERE id = ANY($1::text[]) AND description LIKE $2 RETURNING business_id",
      [taskIds, `${runName}%`],
    );
    await connection.query(
      "DELETE FROM businesses WHERE id = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.business_id = businesses.id)",
      [deletedTasks.rows.map(({ business_id }) => business_id)],
    );
    await connection.query(
      "DELETE FROM teams WHERE id = ANY($1::text[]) AND name LIKE $2",
      [teamIds, `${runName}%`],
    );
    await connection.query("COMMIT");
    console.log(
      `Cleaned up ${taskIds.length} test task(s) and ${teamIds.length} test team(s).`,
    );
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

async function main() {
  const business = new ApiClient();
  const studentA = new ApiClient();
  const studentB = new ApiClient();
  await business.ok("PATCH", "/api/session", { role: "business" });
  await studentA.ok("PATCH", "/api/session", { role: "student" });
  await studentB.ok("PATCH", "/api/session", { role: "student" });
  assert.equal(
    (await business.ok<Workspace>("GET", "/api/workspace")).session.role,
    "business",
  );
  assert.equal(
    (await studentA.ok<Workspace>("GET", "/api/workspace")).session.role,
    "student",
  );

  const malformed = await business.request("POST", "/api/tasks", undefined, {
    rawBody: "{",
  });
  assert.equal(malformed.status, 400, "Malformed JSON must be a client error");
  const wrongType = await business.request("POST", "/api/tasks", undefined, {
    rawBody: "plain text",
    contentType: "text/plain",
  });
  assert.equal(
    wrongType.status,
    415,
    "Non-JSON input must be rejected with unsupported media type",
  );
  const oversized = await business.request("POST", "/api/tasks", {
    description: "x".repeat(128 * 1024),
  });
  assert.equal(
    oversized.status,
    413,
    "Oversized JSON must be rejected before parsing",
  );
  const foreignOrigin = await business.request(
    "POST",
    "/api/tasks",
    { description: "short" },
    { origin: "https://evil.example" },
  );
  assert.equal(
    foreignOrigin.status,
    403,
    "Foreign-origin writes must be rejected",
  );
  const configuredUrl = new URL(baseUrl);
  if (["localhost", "127.0.0.1", "[::1]"].includes(configuredUrl.hostname)) {
    configuredUrl.hostname = "127.0.0.1";
    const loopback = new ApiClient(configuredUrl.origin);
    const sameOrigin = await loopback.request("POST", "/api/tasks", {
      description: "short",
    });
    assert.equal(
      sameOrigin.status,
      422,
      "A 127.0.0.1 Origin matching Host must reach validation even when Next normalizes request.url to localhost",
    );
  }
  await business.fails("POST", "/api/tasks", { description: " " }, [422]);
  await studentA.fails("POST", "/api/tasks", { description: runName }, [403]);
  await business.fails(
    "PATCH",
    "/api/session",
    { role: "administrator" },
    [422],
  );

  let task = await business.ok<SavedTask>("POST", "/api/tasks", {
    description: `${runName}: improve shipment planning. PRIVATE_UNCONFIRMED_ORIGINAL_INPUT`,
  });
  taskIds.push(task.id);
  assert.match(task.id, /^[0-9a-f-]{36}$/i);
  assert.ok(Number.isInteger(task.version));
  assert.equal(task.status, "draft");
  const taskPath = `/api/tasks/${task.id}`;
  let assessment = await business.ok<Assessment>("GET", `${taskPath}/score`);
  validateAssessment(assessment);
  assert.equal(assessment.score, 0);
  assert.equal(assessment.recalculation.firstEvaluation, true);
  const studentDraftView = await studentA.ok<Workspace>(
    "GET",
    "/api/workspace",
  );
  assert.ok(
    !studentDraftView.tasks.some(({ id }) => id === task.id),
    "Student catalog must exclude drafts",
  );
  await studentA.fails("GET", `${taskPath}/score`, undefined, [403, 404]);
  await studentA.fails(
    "PATCH",
    taskPath,
    { ...task, title: "Unauthorized edit" },
    [403],
  );

  const fields: Record<TaskField, string> = {
    context:
      "A warehouse team manages 50 daily shipments in a shared spreadsheet.",
    need: "Dispatchers spend two hours each day resolving duplicate shipment entries.",
    users:
      "Three warehouse dispatchers will review, edit, and export shipments.",
    data: `PRIVATE_UNCONFIRMED_${runName}: a CSV sample of 100 anonymized shipments`,
    constraints:
      "Deliver in two weeks with TypeScript and PostgreSQL; no paid services.",
    outcome:
      "A running web prototype with CSV import, duplicate detection, and export.",
    success:
      "Reduce duplicate entries from 10 to no more than 2 per 100 shipments.",
    contact:
      "The operations manager will answer questions and accept the result.",
    interaction: "Thirty-minute feedback calls every Tuesday and Thursday.",
  };
  const oldVersion = task.version;
  task = await business.ok<SavedTask>("PATCH", taskPath, {
    ...task,
    title: runName,
    company: "Integration Warehouse",
    industry: "Логистика",
    fields,
    confirmedFields: ["context", "need"],
    version: task.version,
  });
  assert.ok(task.version > oldVersion);
  await business.fails(
    "PATCH",
    taskPath,
    { ...task, title: "Stale edit", version: oldVersion },
    [409],
  );
  assessment = await business.ok<Assessment>("GET", `${taskPath}/score`);
  validateAssessment(assessment);
  assert.equal(assessment.score, 20);
  assert.equal(assessment.recalculation.previousScore, 0);
  assert.equal(assessment.recalculation.delta, 20);
  assert.ok(assessment.recalculation.closedItems.length > 0);
  assert.deepEqual(
    await business.ok("GET", `${taskPath}/score`),
    assessment,
    "Reading an assessment must not create a new score event",
  );

  const edits = await Promise.all([
    business.request<SavedTask>("PATCH", taskPath, {
      ...task,
      title: `${runName} A`,
    }),
    business.request<SavedTask>("PATCH", taskPath, {
      ...task,
      title: `${runName} B`,
    }),
  ]);
  assert.deepEqual(
    edits.map(({ status }) => status).sort(),
    [200, 409],
    "Concurrent edits with one version must have one winner",
  );
  task = edits.find(({ status }) => status === 200)!.body;
  await business.fails(
    "PATCH",
    taskPath,
    { ...task, status: "published" },
    [422],
  );
  const publishFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      ["context", "need"].includes(key) ? value : "",
    ]),
  ) as Record<TaskField, string>;
  task = await business.ok<SavedTask>("PATCH", taskPath, {
    ...task,
    fields: publishFields,
    status: "published",
  });
  const publicTask = (
    await studentA.ok<Workspace>("GET", "/api/workspace")
  ).tasks.find(({ id }) => id === task.id);
  assert.ok(publicTask, "Published tasks must appear in the student catalog");
  assert.equal(publicTask.fields.context, fields.context);
  assert.ok(
    !JSON.stringify(publicTask).includes("PRIVATE_UNCONFIRMED_"),
    "Unconfirmed field content must stay private",
  );
  const publicAssessment = await studentA.ok<Assessment>(
    "GET",
    `${taskPath}/score`,
  );
  validateAssessment(publicAssessment);
  assert.equal(publicAssessment.score, 20);
  assert.ok(!JSON.stringify(publicAssessment).includes("PRIVATE_UNCONFIRMED_"));
  task = await business.ok<SavedTask>("PATCH", taskPath, {
    ...task,
    fields,
    confirmedFields: Object.keys(fields),
  });
  assessment = await business.ok<Assessment>("GET", `${taskPath}/score`);
  validateAssessment(assessment);
  assert.equal(assessment.score, 100);
  assert.equal(assessment.level, "priority");
  assert.equal(assessment.recalculation.previousScore, 20);
  assert.equal(assessment.recalculation.delta, 80);
  assert.deepEqual(assessment.missing, []);
  console.log(
    "Passed validation, role filtering, field privacy, score history, and concurrent edit checks.",
  );

  const teamA = await studentA.ok<Team>("POST", "/api/teams", teamFixture("A"));
  teamIds.push(teamA.id);
  const teamB = await studentB.ok<Team>("POST", "/api/teams", teamFixture("B"));
  teamIds.push(teamB.id);
  await studentA.ok("PATCH", "/api/session", {
    role: "student",
    teamId: teamA.id,
  });
  await studentB.ok("PATCH", "/api/session", {
    role: "student",
    teamId: teamB.id,
  });
  assert.equal(
    (await studentA.ok<Workspace>("GET", "/api/workspace")).session.teamId,
    teamA.id,
  );
  assert.equal(
    (await studentB.ok<Workspace>("GET", "/api/workspace")).session.teamId,
    teamB.id,
  );
  const updatedTeam = await studentA.ok<Team>(
    "PATCH",
    `/api/teams/${teamA.id}`,
    { ...teamA, tagline: "Updated and persisted team profile" },
  );
  assert.equal(updatedTeam.tagline, "Updated and persisted team profile");
  await studentA.fails(
    "PATCH",
    `/api/teams/${teamB.id}`,
    { ...teamB, name: "Unauthorized team edit" },
    [403],
  );
  const proposalInput = {
    idea: "Import shipments and highlight likely duplicates for a dispatcher to resolve.",
    plan: "Inspect CSV samples, implement matching rules, and validate with dispatchers.",
    timeline: "Two weeks, including two feedback sessions.",
    prototypeUrl: "https://example.com/integration-prototype",
  };
  await business.fails(
    "POST",
    `${taskPath}/proposals`,
    { ...proposalInput, teamId: teamA.id },
    [403],
  );
  await studentA.fails(
    "POST",
    `${taskPath}/proposals`,
    { ...proposalInput, teamId: teamB.id },
    [403],
  );
  const duplicateAttempts = await Promise.all([
    studentA.request<Proposal>("POST", `${taskPath}/proposals`, {
      ...proposalInput,
      teamId: teamA.id,
    }),
    studentA.request<Proposal>("POST", `${taskPath}/proposals`, {
      ...proposalInput,
      teamId: teamA.id,
    }),
  ]);
  assert.equal(
    duplicateAttempts.filter(({ status }) => status >= 200 && status < 300)
      .length,
    1,
    "Only one concurrent proposal per team/task may succeed",
  );
  assert.equal(
    duplicateAttempts.filter(({ status }) => status === 409).length,
    1,
  );
  const proposalA = duplicateAttempts.find(
    ({ status }) => status >= 200 && status < 300,
  )!.body;
  const proposalB = await studentB.ok<Proposal>(
    "POST",
    `${taskPath}/proposals`,
    { ...proposalInput, teamId: teamB.id },
  );
  assert.equal(proposalA.taskId, task.id);
  assert.equal(proposalA.teamId, teamA.id);
  const proposalPath = `/api/proposals/${proposalA.id}`;
  const milestone = {
    title: "CSV import and duplicate review prototype",
    resultUrl: "https://example.com/integration-result",
    comment:
      "The prototype imports the sample and flags the expected duplicate rows.",
  };
  await studentA.fails("PUT", `${proposalPath}/milestone`, milestone, [409]);
  await studentA.fails(
    "POST",
    `${proposalPath}/decision`,
    { status: "selected" },
    [403],
  );
  await business.ok("POST", `${proposalPath}/decision`, { status: "selected" });
  await business.ok("POST", `/api/proposals/${proposalB.id}/decision`, {
    status: "selected",
  });
  const selections = (
    await business.ok<Workspace>("GET", "/api/workspace")
  ).proposals.filter(
    (proposal) => proposal.taskId === task.id && proposal.status === "selected",
  );
  assert.equal(
    selections.length,
    2,
    "A task must support selecting more than one team",
  );
  await business.fails("POST", `${proposalPath}/milestone/confirm`, {}, [409]);
  await studentB.fails("PUT", `${proposalPath}/milestone`, milestone, [403]);
  await business.fails("PUT", `${proposalPath}/milestone`, milestone, [403]);
  await studentA.fails(
    "PUT",
    `${proposalPath}/milestone`,
    { ...milestone, resultUrl: "javascript:alert(1)" },
    [422],
  );
  const submitted = await studentA.ok<Proposal>(
    "PUT",
    `${proposalPath}/milestone`,
    milestone,
  );
  assert.deepEqual(submitted.milestone, milestone);
  assert.equal(submitted.milestoneConfirmed, false);
  await studentA.fails("POST", `${proposalPath}/milestone/confirm`, {}, [403]);
  const confirmations = await Promise.all([
    business.ok<Proposal>("POST", `${proposalPath}/milestone/confirm`, {}),
    business.ok<Proposal>("POST", `${proposalPath}/milestone/confirm`, {}),
  ]);
  assert.ok(confirmations.every((proposal) => proposal.milestoneConfirmed));
  await business.ok("POST", `${proposalPath}/milestone/confirm`, {});
  const progress = await business.ok<{
    points: number;
    confirmedMilestones: unknown[];
  }>("GET", `/api/teams/${teamA.id}/progress`);
  assert.equal(
    progress.points,
    10,
    "Retries and concurrent confirmation must award exactly ten points once",
  );
  assert.equal(progress.confirmedMilestones.length, 1);
  const deselected = await business.ok<Proposal>(
    "POST",
    `${proposalPath}/decision`,
    { status: "rejected" },
  );
  assert.equal(
    deselected.milestoneConfirmed,
    true,
    "Changing selection must preserve completed work",
  );
  assert.deepEqual(
    await business.ok("GET", `/api/teams/${teamA.id}/progress`),
    progress,
  );
  const reselected = await business.ok<Proposal>(
    "POST",
    `${proposalPath}/decision`,
    { status: "selected" },
  );
  assert.equal(reselected.milestoneConfirmed, true);
  assert.deepEqual(
    await business.ok("GET", `/api/teams/${teamA.id}/progress`),
    progress,
    "Reselecting a team must not award its milestone twice",
  );
  await studentA.fails(
    "PUT",
    `${proposalPath}/milestone`,
    { ...milestone, comment: "Changed after acceptance" },
    [409],
  );

  const freshBrowser = new ApiClient();
  await freshBrowser.ok("PATCH", "/api/session", { role: "business" });
  const persisted = await freshBrowser.ok<Workspace>("GET", "/api/workspace");
  assert.deepEqual(
    persisted.tasks.find(({ id }) => id === task.id),
    task,
  );
  assert.equal(
    persisted.teams.find(({ id }) => id === teamA.id)?.tagline,
    updatedTeam.tagline,
  );
  const persistedProposal = persisted.proposals.find(
    ({ id }) => id === proposalA.id,
  );
  assert.equal(persistedProposal?.milestoneConfirmed, true);
  assert.deepEqual(persistedProposal?.milestone, milestone);
  assert.equal(
    persisted.proposals.filter((proposal) => proposal.taskId === task.id)
      .length,
    2,
  );
  console.log(
    "Passed team persistence, proposal uniqueness/relations, multi-team selection, milestone permissions, and idempotent progress checks.",
  );
}

try {
  await main();
  console.log(
    "Backend integration checks passed against the live HTTP server and database.",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(
      "Failed to clean up scoped integration records:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  }
}
