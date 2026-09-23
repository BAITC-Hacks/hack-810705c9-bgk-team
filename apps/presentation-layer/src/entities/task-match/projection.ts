import type { Task as WorkspaceTask, TaskField as WorkspaceField } from "@/entities/workspace/model";
import type { taskFields, tasks } from "@/shared/db/schema";

type TaskRow = typeof tasks.$inferSelect;
type FieldRow = typeof taskFields.$inferSelect;

const FIELD_NODES: Record<WorkspaceField, string[]> = {
  context: ["context.current", "context.size"],
  need: ["context.change"],
  users: ["users.role", "users.scale"],
  data: ["data.what", "data.volume", "data.sample"],
  constraints: ["constraints.deadline", "constraints.stack", "constraints.other"],
  outcome: ["result.artifact", "result.acceptance"],
  success: ["criteria.items"],
  contact: ["link.contact"],
  interaction: ["link.cadence", "link.response"],
};

// The existing workspace renders nine groups. This adapter keeps its view usable
// while task_fields remains the authoritative 17-node record.
export function projectWorkspaceTask(task: TaskRow, rows: FieldRow[]): WorkspaceTask & { score: number } {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const fields = {} as Record<WorkspaceField, string>;
  const confirmedFields: WorkspaceField[] = [];
  for (const [group, keys] of Object.entries(FIELD_NODES) as [WorkspaceField, string[]][]) {
    fields[group] = keys.map((key) => byKey.get(key)?.value.trim()).filter(Boolean).join("\n");
    if (keys.some((key) => byKey.get(key)?.state === "confirmed")) confirmedFields.push(group);
  }
  return {
    id: task.id,
    title: task.title ?? "Новая задача",
    company: task.company,
    industry: task.topic,
    description: task.description,
    fields,
    confirmedFields,
    status: task.status === "draft" ? "draft" : "published",
    score: task.score,
    createdAt: task.createdAt.toISOString(),
  };
}
