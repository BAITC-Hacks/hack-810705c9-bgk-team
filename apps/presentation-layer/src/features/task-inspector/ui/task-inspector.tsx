"use client";

import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowUturnCcwLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutCellsLarge,
  LayoutList,
  Xmark,
} from "@gravity-ui/icons";
import {
  TASK_FIELDS,
  calculateScore,
  readiness,
  type Proposal,
  type Task,
  type Team,
} from "@/entities/workspace";
import { Button } from "@/shared/components/ui/button";
import { IconAction } from "@/shared/components/icon-action";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

type ApplicationInput = {
  idea: string;
  plan: string;
  timeline: string;
  prototypeUrl: string;
};

export type TaskInspectorProps = {
  role: "business" | "student";
  task: Task;
  teams: Team[];
  proposals: Proposal[];
  activeTeamId: string;
  onDecision: (id: string, status: "pending" | "selected" | "rejected", reason?: string) => void;
  canUndoDecision?: boolean;
  onApply: (input: ApplicationInput) => void;
  onMilestone: (id: string) => void;
  onEditTask: () => void;
  onClose?: () => void;
};

const proposalStatus = {
  pending: "На рассмотрении",
  selected: "Команда выбрана",
  rejected: "Отклонён",
};

function safePrototypeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function StatusLabel({ status }: { status: Proposal["status"] }) {
  return (
    <span className="text-xs font-semibold text-foreground">
      {proposalStatus[status]}
    </span>
  );
}

function TeamAvatar({ team, small = false }: { team: Team; small?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-foreground",
        small ? "size-8 text-xs" : "size-10 text-sm",
      )}
    >
      {team.initials}
    </div>
  );
}

function ProposalDetails({ proposal }: { proposal: Proposal }) {
  const steps = proposal.plan
    .split(/\n|→/)
    .map((step) => step.replace(/^\s*(?:\d+[.)]|[-•])\s*/, "").trim())
    .filter(Boolean);
  const prototypeUrl = safePrototypeUrl(proposal.prototypeUrl);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Идея решения</h4>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/85">
          {proposal.idea}
        </p>
      </section>
      <section className="space-y-2.5">
        <h4 className="text-sm font-semibold">План работы</h4>
        <ol className="list-decimal space-y-2.5 pl-4 marker:text-muted-foreground">
          {steps.map((step, index) => (
            <li
              key={`${index}-${step}`}
              className="break-words pl-1 text-sm leading-relaxed text-foreground/85"
            >
              {step}
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[13px]">
        <span className="min-w-0 break-words text-muted-foreground">
          Срок: {proposal.timeline}
        </span>
        {prototypeUrl ? (
          <a
            href={prototypeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Демо-прототип{" "}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
            <span className="sr-only"> — откроется в новой вкладке</span>
          </a>
        ) : (
          <span className="text-muted-foreground">Прототип не указан</span>
        )}
      </div>
    </div>
  );
}

function BusinessInspector({
  task,
  teams,
  proposals,
  onDecision,
  canUndoDecision = true,
  onMilestone,
  onEditTask,
  onClose,
}: TaskInspectorProps) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const taskProposals = proposals.filter(
    (proposal) => proposal.taskId === task.id,
  );
  const activeIndex = Math.max(
    0,
    taskProposals.findIndex((proposal) => proposal.id === activeProposalId),
  );
  const proposal = taskProposals[activeIndex];
  const team = proposal
    ? teams.find((item) => item.id === proposal.teamId)
    : undefined;
  const selectedCount = taskProposals.filter(
    (item) => item.status === "selected",
  ).length;

  return (
    <>
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2
            id="inspector-title"
            className="flex items-center gap-2 text-base font-bold tracking-tight"
          >
            Отклики{" "}
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {taskProposals.length}
            </span>
          </h2>
        </div>
        <div
          role="group"
          aria-label="Действия с откликами"
          className="flex shrink-0 gap-0.5"
        >
          <IconAction
            label="Карточки откликов"
            aria-pressed={view === "cards"}
            className={cn(view === "cards" && "bg-muted text-foreground")}
            onClick={() => setView("cards")}
          >
            <LayoutCellsLarge className="size-4" />
          </IconAction>
          <IconAction
            label="Список откликов"
            aria-pressed={view === "list"}
            className={cn(view === "list" && "bg-muted text-foreground")}
            onClick={() => setView("list")}
          >
            <LayoutList className="size-4" />
          </IconAction>
          {onClose ? (
            <IconAction label="Скрыть отклики" shortcut="Alt+3" onClick={onClose}>
              <Xmark className="size-4" aria-hidden="true" />
            </IconAction>
          ) : null}
        </div>
      </div>

      <div
        key={`${view}-${proposal?.id ?? "empty"}`}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
      >
        {!proposal ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 py-9 text-center">
            <h3 className="text-base font-semibold">Пока без откликов</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {task.status === "draft"
                ? "Опубликуйте задачу, чтобы команды могли предложить своё решение."
                : "Здесь будут идеи и планы команд. Первый отклик можно отправить в режиме студента."}
            </p>
            {task.status === "draft" ? (
              <Button className="mt-5" variant="outline" onClick={onEditTask}>
                Дополнить задачу
              </Button>
            ) : null}
          </div>
        ) : view === "list" ? (
          <div className="divide-y">
            {taskProposals.map((item) => {
              const proposalTeam = teams.find(
                (candidate) => candidate.id === item.teamId,
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveProposalId(item.id);
                    setView("cards");
                  }}
                  className="group w-full px-1 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={`Открыть отклик команды ${proposalTeam?.name ?? "Команда"}`}
                >
                  <div className="flex items-center gap-3">
                    {proposalTeam ? (
                      <TeamAvatar team={proposalTeam} small />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">
                        {proposalTeam?.name ?? "Команда"}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {proposalTeam?.members ?? 0} в команде
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mb-3 mt-3 line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
                    {item.idea}
                  </p>
                  <StatusLabel status={item.status} />
                </button>
              );
            })}
          </div>
        ) : (
          <article
            className="py-1"
            aria-label={`Отклик команды ${team?.name ?? "Команда"}`}
          >
            <div className="mb-4 border-b pb-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                {team ? <TeamAvatar team={team} /> : null}
                {proposal.status !== "pending" ? (
                  <StatusLabel status={proposal.status} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Отклик команды
                  </span>
                )}
              </div>
              <h3 className="break-words text-[22px] font-bold leading-tight tracking-tight">
                {team?.name ?? "Команда"}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {team?.members ?? 0} в команде ·{" "}
                {team?.tagline ?? "Готовы предложить своё решение"}
              </p>
              <p className="mt-3 text-xs font-medium leading-relaxed text-foreground/75">
                {team?.skills.join(" · ")}
              </p>
            </div>
            <ProposalDetails proposal={proposal} />
            {proposal.status === "selected" ? (
              <div className="mt-5 border-t pt-4" aria-live="polite">
                {proposal.milestoneConfirmed ? (
                  <p className="text-[13px] font-semibold text-foreground">
                    Этап подтверждён · +10 баллов
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                      Команда показала результат? Подтвердите этап, чтобы
                      начислить ей 10 баллов.
                    </p>
                    <Button
                      variant="outline"
                      className="h-10 w-full bg-card text-[13px] font-semibold"
                      onClick={() => onMilestone(proposal.id)}
                    >
                      Подтвердить этап
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </article>
        )}
        {taskProposals.length > 0 ? (
          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            {selectedCount > 0
              ? `Выбрано команд: ${selectedCount}. Можно выбрать ещё.`
              : "Можно выбрать несколько команд или ни одной"}
          </p>
        ) : null}
      </div>
      {view === "cards" && proposal ? (
        <footer className="shrink-0 space-y-3 border-t bg-card px-5 py-4">
          <div aria-live="polite">
            {proposal.status === "pending" ? (
              <div className="grid grid-cols-[0.85fr_1.15fr] gap-2">
                <Button
                  variant="outline"
                  className="h-10 px-2 text-[13px] font-semibold"
                  onClick={() => setRejectProposalId(proposal.id)}
                >
                  Отклонить
                </Button>
                <Button
                  className="h-10 gap-1.5 px-2 text-[13px] font-semibold"
                  onClick={() => onDecision(proposal.id, "selected")}
                >
                  Выбрать команду
                </Button>
              </div>
            ) : canUndoDecision ? (
              <Button
                variant="outline"
                className="h-10 w-full text-[13px] font-semibold"
                onClick={() => onDecision(proposal.id, "pending")}
              >
                <ArrowUturnCcwLeft className="size-4" aria-hidden="true" />
                Отменить решение
              </Button>
            ) : null}
          </div>
          <div
            className="flex items-center justify-center gap-1.5"
            aria-label="Навигация по откликам"
          >
            <IconAction
              label="Предыдущий отклик"
              disabled={activeIndex === 0}
              onClick={() =>
                setActiveProposalId(taskProposals[activeIndex - 1].id)
              }
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </IconAction>
            <span
              className="min-w-10 text-center text-xs font-medium tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {activeIndex + 1} из {taskProposals.length}
            </span>
            <IconAction
              label="Следующий отклик"
              disabled={activeIndex === taskProposals.length - 1}
              onClick={() =>
                setActiveProposalId(taskProposals[activeIndex + 1].id)
              }
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </IconAction>
          </div>
        </footer>
      ) : null}
      <Dialog open={rejectProposalId !== null} onOpenChange={(open) => {
        if (!open) { setRejectProposalId(null); setRejectReason(""); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Причина отклонения</DialogTitle>
            <DialogDescription>Команда увидит, почему отклик не подошёл.</DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Причина отклонения"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Например, нужен другой опыт или план работ"
          />
          <DialogFooter>
            <Button
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (!rejectProposalId || !rejectReason.trim()) return;
                onDecision(rejectProposalId, "rejected", rejectReason.trim());
                setRejectProposalId(null);
                setRejectReason("");
              }}
            >
              Отклонить отклик
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ApplicationDialog({
  task,
  team,
  onApply,
}: {
  task: Task;
  team: Team;
  onApply: TaskInspectorProps["onApply"];
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ApplicationInput>({
    idea: "",
    plan: "",
    timeline: "",
    prototypeUrl: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ApplicationInput, string>>
  >({});
  const id = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      idea: values.idea.trim(),
      plan: values.plan.trim(),
      timeline: values.timeline.trim(),
      prototypeUrl: values.prototypeUrl.trim(),
    };
    const nextErrors: typeof errors = {};
    for (const field of Object.keys(input) as (keyof ApplicationInput)[]) {
      if (!input[field]) nextErrors[field] = "Заполните это поле";
    }
    if (input.prototypeUrl && !safePrototypeUrl(input.prototypeUrl))
      nextErrors.prototypeUrl = "Укажите полную ссылку с https:// или http://";
    setErrors(nextErrors);
    const firstError = (
      Object.keys(nextErrors) as (keyof ApplicationInput)[]
    )[0];
    if (firstError) {
      (
        event.currentTarget.elements.namedItem(firstError) as HTMLElement | null
      )?.focus();
      return;
    }
    onApply(input);
    setOpen(false);
  }

  function update(field: keyof ApplicationInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  const fields: {
    key: keyof ApplicationInput;
    label: string;
    placeholder: string;
    multiline?: boolean;
  }[] = [
    {
      key: "idea",
      label: "Идея решения",
      placeholder: "Как вы предлагаете решить задачу?",
      multiline: true,
    },
    {
      key: "plan",
      label: "План работы",
      placeholder: "Основные шаги — каждый с новой строки",
      multiline: true,
    },
    { key: "timeline", label: "Срок", placeholder: "Например, 3 недели" },
    {
      key: "prototypeUrl",
      label: "Ссылка на прототип",
      placeholder: "https://…",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 w-full text-sm font-semibold">
          Предложить решение
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-lg"
      >
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3"
            aria-label="Закрыть форму отклика"
          >
            <Xmark className="size-4" />
          </Button>
        </DialogClose>
        <DialogHeader className="pr-6">
          <DialogTitle className="text-xl font-bold tracking-tight">
            Предложить решение
          </DialogTitle>
          <DialogDescription className="pt-1 text-sm leading-relaxed">
            {team.name} · {task.title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {fields.map((field) => {
            const shared = {
              id: `${id}-${field.key}`,
              name: field.key,
              value: values[field.key],
              required: true,
              placeholder: field.placeholder,
              "aria-invalid": Boolean(errors[field.key]),
              "aria-describedby": errors[field.key]
                ? `${id}-${field.key}-error`
                : undefined,
              onChange: (
                event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
              ) => update(field.key, event.target.value),
            };
            return (
              <div key={field.key} className="space-y-1.5">
                <label htmlFor={shared.id} className="text-sm font-semibold">
                  {field.label}{" "}
                  <span className="text-muted-foreground" aria-hidden="true">
                    *
                  </span>
                </label>
                {field.multiline ? (
                  <Textarea
                    {...shared}
                    className="min-h-22 resize-y text-sm"
                    rows={3}
                  />
                ) : (
                  <Input
                    {...shared}
                    type={field.key === "prototypeUrl" ? "url" : "text"}
                    className="h-10 text-sm"
                  />
                )}
                {errors[field.key] ? (
                  <p
                    id={`${id}-${field.key}-error`}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors[field.key]}
                  </p>
                ) : null}
              </div>
            );
          })}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Все поля обязательны. Бизнес рассмотрит предложение и выберет
            команду самостоятельно.
          </p>
          <DialogFooter className="m-0 gap-2 rounded-none border-0 bg-transparent p-0 pt-2">
            <DialogClose asChild>
              <Button variant="outline" type="button" className="h-10 font-semibold">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" className="h-10 font-semibold">
              Отправить отклик
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudentInspector({
  task,
  teams,
  proposals,
  activeTeamId,
  onApply,
}: TaskInspectorProps) {
  const team = teams.find((item) => item.id === activeTeamId);
  const proposal = proposals.find(
    (item) => item.taskId === task.id && item.teamId === activeTeamId,
  );
  const score = calculateScore(task);
  const readinessState = readiness(score);

  return (
    <>
      <div className="shrink-0 border-b px-5 py-5">
        <h2
          id="inspector-title"
          className="text-base font-bold tracking-tight"
        >
          О задаче
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {task.industry}
            </span>
            <span className="text-xs text-muted-foreground">
              {task.status === "published" ? "Опубликована" : "Черновик"}
            </span>
          </div>
          <h3 className="break-words text-2xl font-bold leading-snug tracking-tight">
            {task.title}
          </h3>
          <p className="mt-2 text-sm font-medium text-muted-foreground">{task.company}</p>
          <div className="mt-5 border-t pt-4">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold">Готовность задачи</span>
              <span className="font-semibold text-primary">
                {score}{" "}
                <span className="font-normal text-muted-foreground">/ 100</span>
              </span>
            </div>
            <div
              className="mb-3 mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Готовность задачи"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-[13px] font-medium text-foreground">
              {readinessState.label}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              На опубликованную задачу можно откликнуться при любой готовности и
              уточнить детали вместе с бизнесом.
            </p>
          </div>
        </section>

        <section
          className="space-y-5 border-t pt-5"
          aria-label="Ключевые детали задачи"
        >
          {[
            {
              label: "Ожидаемый результат",
              value: task.fields.outcome,
            },
            {
              label: "Критерий успеха",
              value: task.fields.success,
            },
            {
              label: "Данные и материалы",
              value: task.fields.data,
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <h3 className="mb-2 text-sm font-semibold">
                {label}
              </h3>
              <p
                className={cn(
                  "break-words text-sm leading-relaxed",
                  value.trim()
                    ? "text-foreground/75"
                    : "italic text-muted-foreground",
                )}
              >
                {value.trim() || "Нужно уточнить с бизнесом"}
              </p>
            </div>
          ))}
        </section>

        <details className="group border-t pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Все сведения
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <dl className="mt-4 space-y-4">
            {TASK_FIELDS.filter(
              ({ key }) => !["outcome", "success", "data"].includes(key),
            ).map(({ key, label }) => (
              <div key={key}>
                <dt className="mb-1.5 text-sm font-semibold">{label}</dt>
                <dd
                  className={cn(
                    "whitespace-pre-line break-words text-sm leading-relaxed",
                    task.fields[key].trim()
                      ? "text-foreground/80"
                      : "italic text-muted-foreground",
                  )}
                >
                  {task.fields[key].trim() || "Нужно уточнить с бизнесом"}
                </dd>
              </div>
            ))}
          </dl>
        </details>

        <section className="border-t pt-5">
          <h3 className="mb-3 text-sm font-semibold">
            {proposal ? "Ваш отклик" : "Ваше решение"}
          </h3>
          {team ? (
            <div className="mb-4 flex items-center gap-2.5">
              <TeamAvatar team={team} small />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{team.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {team.members} в команде
                </p>
              </div>
            </div>
          ) : null}
          {proposal ? (
            <div className="space-y-4">
              <StatusLabel status={proposal.status} />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {proposal.status === "selected"
                  ? "Бизнес выбрал вашу команду. Договоритесь о первом шаге и покажите результат."
                  : proposal.status === "rejected"
                    ? "Для этой задачи бизнес отклонил предложение. Можно выбрать другую задачу и предложить решение."
                    : "Предложение отправлено. Решение появится здесь после рассмотрения бизнесом."}
              </p>
              <div className="border-t pt-4">
                <ProposalDetails proposal={proposal} />
              </div>
              {proposal.milestoneConfirmed ? (
                <p className="text-[13px] font-semibold text-foreground">
                  Этап подтверждён · +10 баллов
                </p>
              ) : null}
            </div>
          ) : task.status === "draft" ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Отклик станет доступен после публикации задачи.
            </p>
          ) : team ? (
            <>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Расскажите, как команда подойдёт к задаче, сколько времени
                понадобится и что вы уже успели проверить.
              </p>
              <ApplicationDialog task={task} team={team} onApply={onApply} />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Выберите свою команду, чтобы предложить решение.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export function TaskInspector(props: TaskInspectorProps) {
  return (
    <aside
      className="flex h-full min-h-0 min-w-0 flex-col bg-card"
      aria-labelledby="inspector-title"
    >
      {props.role === "business" ? (
        <BusinessInspector key={props.task.id} {...props} />
      ) : (
        <StudentInspector
          key={`${props.task.id}-${props.activeTeamId}`}
          {...props}
        />
      )}
    </aside>
  );
}
