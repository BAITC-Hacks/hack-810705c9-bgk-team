import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTask } from "./model";
import { getWorkspaceTasks, workspaceIdentity } from "./task-scope";

describe("workspace task scope", () => {
  const catalog = { ...createTask("Published catalog task"), id: "catalog", canEdit: false };
  const own = { ...createTask("Own draft"), id: "own", canEdit: true };
  const unverified = { ...createTask("Task without ownership metadata"), id: "unverified" };

  it("selects an owned task even when the catalog task comes first", () => {
    assert.deepEqual(getWorkspaceTasks([catalog, own], "business"), [own]);
  });

  it("shows the create-first-task state when a business only has catalog tasks", () => {
    assert.deepEqual(getWorkspaceTasks([catalog], "business"), []);
  });

  it("requires explicit ownership before exposing business editing tools", () => {
    assert.deepEqual(getWorkspaceTasks([unverified, own], "business"), [own]);
  });

  it("retains all server-visible tasks for the student catalog", () => {
    assert.deepEqual(getWorkspaceTasks([catalog, own], "student"), [catalog, own]);
  });

  it("changes student workspace identity when switching teams with a retained business profile", () => {
    const session = { role: "student" as const, businessId: "business", teamId: "team-1" };
    assert.notEqual(workspaceIdentity(session), workspaceIdentity({ ...session, teamId: "team-2" }));
    assert.equal(workspaceIdentity(session), workspaceIdentity({ ...session, businessId: "other" }));
  });

  it("separates business profiles and roles while ignoring an inactive team", () => {
    const session = { role: "business" as const, businessId: "business-1", teamId: "team" };
    assert.notEqual(workspaceIdentity(session), workspaceIdentity({ ...session, businessId: "business-2" }));
    assert.notEqual(workspaceIdentity(session), workspaceIdentity({ ...session, role: "student" }));
    assert.equal(workspaceIdentity(session), workspaceIdentity({ ...session, teamId: "other" }));
  });
});
