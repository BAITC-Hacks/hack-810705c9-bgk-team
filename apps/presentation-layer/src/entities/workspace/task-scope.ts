import type { Role, Task } from "./model";

/** Retained profiles for another role must not determine the active workspace. */
export function workspaceIdentity(session: { role: Role; businessId?: string | null; teamId?: string | null }): string {
  return `${session.role}:${session.role === "business" ? session.businessId : session.teamId}`;
}

/** The business workspace manages owned tasks; the catalog has its own surface. */
export function getWorkspaceTasks(tasks: readonly Task[], role: Role): Task[] {
  return role === "business"
    ? tasks.filter((task) => task.canEdit === true)
    : [...tasks];
}
