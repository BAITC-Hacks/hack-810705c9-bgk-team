/** Run against the local app after migrations: node --env-file=.env scripts/test-onboarding.ts */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const marker = `Onboarding verification ${randomUUID()}`;
const taskIds: string[] = [];
const businessIds = new Set<string>();
const pool = new Pool({ connectionString: process.env.DATABASE_URL_NEXTJS });
if (!process.env.DATABASE_URL_NEXTJS) throw new Error("DATABASE_URL_NEXTJS is required for fixture cleanup.");

function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, expected = 200) => {
    const response = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        Origin: new URL(baseUrl).origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    for (const value of response.headers.getSetCookie()) {
      assert.match(value, /httponly/i);
      cookie = value.split(";", 1)[0];
    }
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
    return result;
  };
}

try {
  const request = client();
  const freshSession = await request("GET", "/api/session");
  assert.equal(freshSession.onboardingCompleted, false);
  assert.equal(freshSession.teamId, null, "A new session must not silently select a team.");
  const teams = await request("GET", "/api/teams");
  assert.ok(teams.length, "Seed at least one demo team before this check.");
  await request("POST", "/api/onboarding", { role: "business", companyName: "   " }, 422);
  await request("POST", "/api/onboarding", {
    role: "business", companyName: marker, logoKey: `${randomUUID()}.png`,
  }, 422);
  await request("PATCH", "/api/session", { onboardingCompleted: true }, 422);

  const business = await request("POST", "/api/onboarding", { role: "business", companyName: marker });
  businessIds.add(business.businessId);
  assert.equal(business.onboardingCompleted, true);
  assert.equal((await request("GET", "/api/session")).businessId, business.businessId);
  assert.equal((await request("GET", "/api/workspace")).business.name, marker);
  const repeated = await request("POST", "/api/onboarding", { role: "business", companyName: marker });
  assert.equal(repeated.businessId, business.businessId, "Resubmission must reuse the session business.");
  assert.equal(repeated.teamId, null);
  const unselectedStudent = await request("PATCH", "/api/session", { role: "student" });
  assert.equal(unselectedStudent.teamId, null);
  assert.equal(unselectedStudent.onboardingCompleted, false, "Business setup must not bypass picking a student team.");
  assert.equal((await request("GET", "/api/workspace")).session.onboardingCompleted, false);
  const previousBusiness = await request("PATCH", "/api/session", { role: "business" });
  assert.equal(previousBusiness.businessId, business.businessId);
  assert.equal(previousBusiness.onboardingCompleted, true, "Returning to an existing business preserves its completed setup.");

  const first = await request("POST", "/api/tasks", { description: `${marker}: first task description` }, 201);
  taskIds.push(first.id);
  const second = await request("POST", "/api/tasks", { description: `${marker}: second task description` }, 201);
  taskIds.push(second.id);
  assert.equal(first.company, marker);
  assert.equal(second.company, marker);
  await request("PATCH", `/api/tasks/${first.id}`, { ...first, company: `${marker} task only` });
  assert.equal((await request("GET", `/api/tasks/${second.id}`)).company, marker);
  assert.equal((await request("GET", "/api/workspace")).business.name, marker);
  const detached = await pool.query<{ business_id: string }>("SELECT business_id FROM tasks WHERE id = $1", [first.id]);
  businessIds.add(detached.rows[0].business_id);
  assert.notEqual(detached.rows[0].business_id, business.businessId);

  const student = await request("POST", "/api/onboarding", { role: "student", teamId: teams[0].id });
  assert.equal(student.teamId, teams[0].id);
  assert.equal(student.onboardingCompleted, true);
  assert.equal(student.businessId, business.businessId);
  const restored = await request("PATCH", "/api/session", { role: "business" });
  assert.equal(restored.businessId, business.businessId);
  assert.equal(restored.onboardingCompleted, true);
  const selectedStudent = await request("PATCH", "/api/session", { role: "student" });
  assert.equal(selectedStudent.teamId, teams[0].id);
  assert.equal(selectedStudent.onboardingCompleted, true, "An explicit team choice must survive role switches.");
  assert.equal((await request("GET", "/api/session")).onboardingCompleted, true);
  await request("PATCH", "/api/session", { role: "business" });
  await request("POST", "/api/onboarding", { role: "student", teamId: `missing-${randomUUID()}` }, 404);
  assert.equal((await request("GET", "/api/session")).role, "business");

  const freshStudent = client();
  await freshStudent("POST", "/api/onboarding", { role: "student", teamId: teams[0].id });
  const persistedStudent = await freshStudent("GET", "/api/session");
  assert.equal(persistedStudent.role, "student");
  assert.equal(persistedStudent.teamId, teams[0].id);
  assert.equal(persistedStudent.onboardingCompleted, true);
  const unfinishedBusiness = await freshStudent("PATCH", "/api/session", { role: "business" });
  assert.equal(unfinishedBusiness.onboardingCompleted, false);
  const returningStudent = await freshStudent("PATCH", "/api/session", { role: "student" });
  assert.equal(returningStudent.teamId, teams[0].id);
  assert.equal(returningStudent.onboardingCompleted, true, "An unfinished business branch must not erase completed student setup.");
  console.log("Onboarding integration passed: validation, durable profile, repeat submission, task defaults, copy-on-write, student selection, and role switching.");
} finally {
  if (taskIds.length) {
    const attached = await pool.query<{ business_id: string }>(
      "SELECT business_id FROM tasks WHERE id = ANY($1::text[]) AND description LIKE $2",
      [taskIds, `${marker}%`],
    );
    attached.rows.forEach((row) => businessIds.add(row.business_id));
    await pool.query("DELETE FROM tasks WHERE id = ANY($1::text[]) AND description LIKE $2", [taskIds, `${marker}%`]);
  }
  if (businessIds.size) await pool.query(
    "DELETE FROM businesses WHERE id = ANY($1::text[]) AND name LIKE $2 AND NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.business_id = businesses.id)",
    [[...businessIds], `${marker}%`],
  );
  await pool.end();
}
