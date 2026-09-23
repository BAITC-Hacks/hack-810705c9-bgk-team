// ADR-008, п. 3: видимость данных по ролям. Чистые функции без БД;
// use-case загружает строки и пропускает их через эти фильтры.

import type { DemoActor } from "@/shared/lib/demo-actor";

import type {
  AccessField,
  AccessProposal,
  AccessStage,
  AccessTask,
  TaskAccess,
} from "./types";

/**
 * Явный список полей задачи, видимых исполнителю (раздел 10 платформы).
 * Всё, чего здесь нет (черновик, внутренние заметки, будущие колонки), не
 * попадает в вид исполнителя, пока его сюда не добавят осознанно.
 */
export const EXECUTOR_TASK_KEYS = [
  "id",
  "businessId",
  "company",
  "title",
  "topic",
  "status",
  "engagement",
  "compensationNote",
  "neededRoles",
  "neededSkills",
  "score",
  "level",
  "publishedAt",
  "criteriaVersion",
] as const;

/** Поля карточки для исполнителя: без источника, цитаты и реплики бизнеса (FR-2.5). */
export const EXECUTOR_FIELD_KEYS = ["node", "value", "state", "notApplicable", "confirmedAt"] as const;

type ExecutorTaskKey = (typeof EXECUTOR_TASK_KEYS)[number];
type ExecutorFieldKey = (typeof EXECUTOR_FIELD_KEYS)[number];

/** Поле карточки, которое видит исполнитель. */
export type ExecutorField<F extends AccessField> = Pick<F, Extract<keyof F, ExecutorFieldKey>>;

export type ExecutorTaskView<T extends AccessTask> = Pick<T, Extract<keyof T, ExecutorTaskKey>> & {
  fields: ExecutorField<T["fields"][number]>[];
};

/**
 * Карточка глазами команды. Один фильтр для роли `team`, каталога и
 * переключателя «Вид исполнителя» (FR-2.8):
 * - только `confirmed` поля (FR-4.1), `suggested` и `empty` скрыты;
 * - «не применимо» остаётся с пояснением в `value` (FR-1.11);
 * - в ответ попадают только ключи из EXECUTOR_TASK_KEYS / EXECUTOR_FIELD_KEYS.
 */
export function toExecutorView<T extends AccessTask>(task: T): ExecutorTaskView<T> {
  return {
    ...pick(task, EXECUTOR_TASK_KEYS),
    fields: (task.fields as T["fields"][number][])
      .filter((field) => field.state === "confirmed")
      .map((field) => pick(field, EXECUTOR_FIELD_KEYS)),
  };
}

function pick<T extends object, K extends string>(
  value: T,
  keys: readonly K[],
): Pick<T, Extract<keyof T, K>> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(value, key)) result[key] = (value as Record<string, unknown>)[key];
  }
  return result as Pick<T, Extract<keyof T, K>>;
}

/**
 * Уровень доступа участника к задаче или `null`, если задача ему не видна.
 * Команда видит опубликованные задачи; задачи `in_work` / `closed` — только
 * если у неё есть отклик на них (свои отклики и этапы видны полностью).
 */
export function taskAccess(
  actor: DemoActor,
  task: AccessTask,
  proposals: readonly AccessProposal[] = [],
): TaskAccess | null {
  if (actor.role === "business") {
    if (task.businessId === actor.businessId) return "owner";
    return task.status === "published" ? "catalog" : null;
  }
  if (task.status === "published") return "executor";
  if (task.status === "draft") return null;
  const hasOwnProposal = proposals.some(
    (proposal) => proposal.taskId === task.id && proposal.teamId === actor.teamId,
  );
  return hasOwnProposal ? "executor" : null;
}

export type VisibleTask<T extends AccessTask> =
  | { access: "owner"; task: T }
  | { access: "executor" | "catalog"; task: ExecutorTaskView<T> };

export function visibleTasks<T extends AccessTask>(
  actor: DemoActor,
  tasks: readonly T[],
  proposals: readonly AccessProposal[] = [],
): VisibleTask<T>[] {
  const result: VisibleTask<T>[] = [];
  for (const task of tasks) {
    const access = taskAccess(actor, task, proposals);
    if (access === "owner") result.push({ access, task });
    else if (access) result.push({ access, task: toExecutorView(task) });
  }
  return result;
}

/** Бизнес видит отклики на свои задачи; команда — только свои отклики. */
export function canViewProposal(
  actor: DemoActor,
  proposal: AccessProposal,
  task: Pick<AccessTask, "id" | "businessId"> | undefined,
): boolean {
  if (actor.role === "team") return proposal.teamId === actor.teamId;
  return !!task && task.id === proposal.taskId && task.businessId === actor.businessId;
}

export function visibleProposals<P extends AccessProposal>(
  actor: DemoActor,
  proposals: readonly P[],
  tasks: readonly Pick<AccessTask, "id" | "businessId">[],
): P[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return proposals.filter((proposal) =>
    canViewProposal(actor, proposal, byId.get(proposal.taskId)),
  );
}

/** Этап виден тому, кому виден его отклик. */
export function visibleStages<S extends AccessStage>(
  stages: readonly S[],
  visible: readonly AccessProposal[],
): S[] {
  const ids = new Set(visible.map((proposal) => proposal.id));
  return stages.filter((stage) => ids.has(stage.proposalId));
}
