"use client";

import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  FileText,
  LayoutGrid,
  List,
  MessageSquare,
  Send,
  Target,
  Trophy,
  Undo2,
  Users,
  X,
} from "lucide-react";
import {
  calculateScore,
  readiness,
  type Proposal,
  type Task,
  type Team,
} from "@/entities/workspace";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
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
};

const proposalStatus = {
  pending: {
    label: "На рассмотрении",
    className: "bg-muted text-muted-foreground",
  },
  selected: {
    label: "Команда выбрана",
    className: "bg-emerald-50 text-emerald-700",
  },
  rejected: { label: "Отклонён", className: "bg-rose-50 text-rose-700" },
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

function StatusBadge({ status }: { status: Proposal["status"] }) {
  const item = proposalStatus[status];
  return (
    <Badge
      variant="secondary"
      className={cn("h-6 px-2.5 text-[11px] font-medium", item.className)}
    >
      {item.label}
    </Badge>
  );
}

function TeamAvatar({ team, small = false }: { team: Team; small?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-[#413654]",
        small ? "size-10 text-xs" : "size-12 text-sm",
      )}
      style={{ backgroundColor: team.color }}
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
        <h4 className="text-xs font-semibold">Идея решения</h4>
        <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-foreground/80">
          {proposal.idea}
        </p>
      </section>
      <section className="space-y-2.5">
        <h4 className="text-xs font-semibold">План работы</h4>
        <ol className="space-y-2.5">
          {steps.map((step, index) => (
            <li
              key={`${index}-${step}`}
              className="flex gap-2.5 text-[13px] leading-relaxed text-foreground/80"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
              >
                {index + 1}
              </span>
              <span className="min-w-0 break-words">{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs">
        <span className="flex min-w-0 items-start gap-2 text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="break-words">{proposal.timeline}</span>
        </span>
        {prototypeUrl ? (
          <a
            href={prototypeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
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
      <div className="flex items-start justify-between gap-2 px-5 pb-5 pt-6">
        <div className="min-w-0">
          <h2
            id="inspector-title"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          >
            Команды и отклики{" "}
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
              {taskProposals.length}
            </span>
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Вы выбираете, с кем работать
          </p>
        </div>
        <div
          role="group"
          aria-label="Вид откликов"
          className="flex shrink-0 rounded-lg border bg-background p-0.5"
        >
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Карточки откликов"
            aria-pressed={view === "cards"}
            className={cn(view === "cards" && "bg-primary/10 text-primary")}
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Список откликов"
            aria-pressed={view === "list"}
            className={cn(view === "list" && "bg-primary/10 text-primary")}
            onClick={() => setView("list")}
          >
            <List className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        {!proposal ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed bg-background/70 px-5 py-9 text-center">
            <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary/8 text-primary">
              <MessageSquare className="size-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold">Пока без откликов</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {task.status === "draft"
                ? "Опубликуйте задачу, чтобы команды могли предложить своё решение."
                : "Здесь будут идеи и планы команд. Первый отклик можно отправить в режиме студента."}
            </p>
            {task.status === "draft" ? (
              <Button className="mt-5" variant="outline" onClick={onEditTask}>
                Дополнить задачу <ArrowUpRight className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ) : view === "list" ? (
          <div className="space-y-2.5">
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
                  className="group w-full rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.025] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={`Открыть отклик команды ${proposalTeam?.name ?? "Команда"}`}
                >
                  <div className="flex items-center gap-3">
                    {proposalTeam ? (
                      <TeamAvatar team={proposalTeam} small />
                    ) : (
                      <Users className="size-5 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">
                        {proposalTeam?.name ?? "Команда"}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {proposalTeam?.members ?? 0} в команде
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mb-3 mt-3 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
                    {item.idea}
                  </p>
                  <StatusBadge status={item.status} />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <article
              className="rounded-xl border bg-background p-4 shadow-[0_2px_8px_-6px_rgba(30,24,55,0.12)]"
              aria-label={`Отклик команды ${team?.name ?? "Команда"}`}
            >
              <div className="mb-4 border-b pb-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  {team ? (
                    <TeamAvatar team={team} />
                  ) : (
                    <Users className="size-8 text-primary" />
                  )}
                  {proposal.status !== "pending" ? (
                    <StatusBadge status={proposal.status} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Отклик команды
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold tracking-tight">
                  {team?.name ?? "Команда"}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {team?.members ?? 0} в команде ·{" "}
                  {team?.tagline ?? "Готовы предложить своё решение"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {team?.skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="h-5 bg-muted/50 px-2 text-[10px] font-normal text-foreground/75"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              <ProposalDetails proposal={proposal} />
              <div className="mt-5" aria-live="polite">
                {proposal.status === "pending" ? (
                  <div className="grid grid-cols-[0.85fr_1.15fr] gap-2">
                    <Button
                      variant="outline"
                      className="h-9 gap-1.5 border-rose-200 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setRejectProposalId(proposal.id)}
                    >
                      <X className="size-3.5" />
                      Отклонить
                    </Button>
                    <Button
                      className="h-9 gap-1.5 px-2 text-xs"
                      onClick={() => onDecision(proposal.id, "selected")}
                    >
                      <Check className="size-3.5" />
                      Выбрать команду
                    </Button>
                  </div>
                ) : canUndoDecision ? (
                  <Button
                    variant="outline"
                    className="h-9 w-full text-xs"
                    onClick={() => onDecision(proposal.id, "pending")}
                  >
                    <Undo2 className="size-3.5" />
                    Отменить решение
                  </Button>
                ) : null}
                {proposal.status === "selected" ? (
                  <div className="mt-3 rounded-lg bg-primary/[0.045] p-3">
                    {proposal.milestoneConfirmed ? (
                      <p className="flex items-center gap-2 text-xs font-medium text-primary">
                        <Trophy className="size-4" />
                        Этап подтверждён · +10 баллов
                      </p>
                    ) : (
                      <>
                        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                          Команда показала результат? Подтвердите этап, чтобы
                          начислить ей 10 баллов.
                        </p>
                        <Button
                          variant="outline"
                          className="h-8 w-full bg-background text-xs"
                          onClick={() => onMilestone(proposal.id)}
                        >
                          <CircleCheck className="size-3.5" />
                          Подтвердить этап
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
            <div
              className="mt-4 flex items-center justify-center gap-7"
              aria-label="Навигация по откликам"
            >
              <Button
                variant="outline"
                size="icon"
                className="size-9 bg-background/60"
                aria-label="Предыдущий отклик"
                disabled={activeIndex === 0}
                onClick={() =>
                  setActiveProposalId(taskProposals[activeIndex - 1].id)
                }
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span
                className="min-w-10 text-center text-xs text-muted-foreground"
                aria-live="polite"
              >
                {activeIndex + 1} из {taskProposals.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-9 bg-background/60"
                aria-label="Следующий отклик"
                disabled={activeIndex === taskProposals.length - 1}
                onClick={() =>
                  setActiveProposalId(taskProposals[activeIndex + 1].id)
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        )}
        {taskProposals.length > 0 ? (
          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            {selectedCount > 0
              ? `Выбрано команд: ${selectedCount}. Можно выбрать ещё.`
              : "Можно выбрать несколько команд или ни одной"}
          </p>
        ) : null}
      </div>
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
        <Button className="h-10 w-full text-xs">
          <Send className="size-3.5" />
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
            <X className="size-4" />
          </Button>
        </DialogClose>
        <DialogHeader className="pr-6">
          <DialogTitle className="text-xl font-semibold">
            Предложить решение
          </DialogTitle>
          <DialogDescription className="pt-1 text-xs leading-relaxed">
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
                <label htmlFor={shared.id} className="text-xs font-medium">
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
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Все поля обязательны. Бизнес рассмотрит предложение и выберет
            команду самостоятельно.
          </p>
          <DialogFooter className="m-0 gap-2 rounded-none border-0 bg-transparent p-0 pt-2">
            <DialogClose asChild>
              <Button variant="outline" type="button" className="h-9">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" className="h-9">
              <Send className="size-3.5" />
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
  const readinessTone = {
    muted: "bg-muted text-muted-foreground",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    violet: "bg-primary/10 text-primary",
  }[readinessState.tone];

  return (
    <>
      <div className="px-5 pb-5 pt-6">
        <h2
          id="inspector-title"
          className="text-[15px] font-semibold tracking-tight"
        >
          О задаче
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          От идеи к первому результату
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5">
        <section className="rounded-xl border bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px] font-normal">
              {task.industry}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {task.status === "published" ? "Опубликована" : "Черновик"}
            </span>
          </div>
          <h3 className="text-base font-semibold leading-snug tracking-tight">
            {task.title}
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground">{task.company}</p>
          <div className="mt-5 border-t pt-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">Готовность задачи</span>
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
            <Badge
              variant="secondary"
              className={cn("h-5 text-[10px]", readinessTone)}
            >
              {readinessState.label}
            </Badge>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              На опубликованную задачу можно откликнуться при любой готовности и
              уточнить детали вместе с бизнесом.
            </p>
          </div>
        </section>

        <section
          className="space-y-5 rounded-xl border bg-background p-4"
          aria-label="Ключевые детали задачи"
        >
          {[
            {
              icon: Target,
              label: "Ожидаемый результат",
              value: task.fields.outcome,
            },
            {
              icon: CircleCheck,
              label: "Критерий успеха",
              value: task.fields.success,
            },
            {
              icon: FileText,
              label: "Данные и материалы",
              value: task.fields.data,
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <Icon className="size-3.5 text-primary/80" aria-hidden="true" />
                {label}
              </h3>
              <p
                className={cn(
                  "break-words text-xs leading-relaxed",
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

        <section className="rounded-xl border bg-background p-4">
          <h3 className="mb-3 text-xs font-semibold">
            {proposal ? "Ваш отклик" : "Ваше решение"}
          </h3>
          {team ? (
            <div className="mb-4 flex items-center gap-2.5">
              <TeamAvatar team={team} small />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{team.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {team.members} в команде
                </p>
              </div>
            </div>
          ) : null}
          {proposal ? (
            <div className="space-y-4">
              <StatusBadge status={proposal.status} />
              <p className="text-xs leading-relaxed text-muted-foreground">
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
                <p className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-xs font-medium text-primary">
                  <CheckCheck className="size-4" />
                  Этап подтверждён · +10 баллов
                </p>
              ) : null}
            </div>
          ) : task.status === "draft" ? (
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Clock3 className="mt-0.5 size-4 shrink-0" />
              Отклик станет доступен после публикации задачи.
            </p>
          ) : team ? (
            <>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                Расскажите, как команда подойдёт к задаче, сколько времени
                понадобится и что вы уже успели проверить.
              </p>
              <ApplicationDialog task={task} team={team} onApply={onApply} />
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
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
      className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border bg-[#f8f8fb]"
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
