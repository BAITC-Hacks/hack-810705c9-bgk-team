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

/** Поле карточки, которое видит исполнитель. */
export type ExecutorField<F extends AccessField> = Omit<
  F,
  "source" | "sourceQuote" | "sourceTurnId"
>;

export type ExecutorTaskView<T extends AccessTask> = Omit<T, "fields" | "draftText"> & {
  fields: ExecutorField<T["fields"][number]>[];
};

/**
 * Карточка глазами команды. Один фильтр для роли `team`, каталога и
 * переключателя «Вид исполнителя» (FR-2.8):
 * - только `confirmed` поля (FR-4.1), `suggested` и `empty` скрыты;
 * - «не применимо» остаётся с пояснением в `value` (FR-1.11);
 * - черновик и реплики-источники бизнеса скрыты.
 */
export function toExecutorView<T extends AccessTask>(task: T): ExecutorTaskView<T> {
  return {
    ...omit(task, ["fields", "draftText"]),
    fields: (task.fields as T["fields"][number][])
      .filter((field) => field.state === "confirmed")
      .map((field) => omit(field, ["source", "sourceQuote", "sourceTurnId"])),
  };
}

function omit<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key as K)),
  ) as Omit<T, K>;
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
