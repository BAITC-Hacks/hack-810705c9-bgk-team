"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Magnifier, Xmark } from "@gravity-ui/icons";
import {
  calculateScore,
  readiness,
  type Proposal,
  type Task,
} from "@/entities/workspace";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { cn } from "@/shared/lib/utils";

type StudentCatalogProps = {
  tasks: Task[];
  proposals: Proposal[];
  activeTeamId: string;
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  teamControl: ReactNode;
  children: ReactNode;
};

const READINESS_FILTERS = [
  { value: "clarify", min: 0, max: 39 },
  { value: "foundation", min: 40, max: 69 },
  { value: "ready", min: 70, max: 89 },
  { value: "complete", min: 90, max: 100 },
] as const;

const PROPOSAL_LABELS: Record<Proposal["status"], string> = {
  pending: "Отклик отправлен",
  selected: "Ваша команда выбрана",
  rejected: "Отклик отклонён",
};

export function StudentCatalog({
  tasks,
  proposals,
  activeTeamId,
  selectedTaskId,
  onSelectTask,
  teamControl,
  children,
}: StudentCatalogProps) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [readinessFilter, setReadinessFilter] = useState("all");
  const [view, setView] = useState<"all" | "applications">("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lastOpenedCard = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const published = tasks.filter((task) => task.status === "published");
  const industries = [...new Set(published.map((task) => task.industry))].sort(
    (a, b) => a.localeCompare(b, "ru"),
  );
  const teamProposals = new Map(
    proposals
      .filter((proposal) => proposal.teamId === activeTeamId)
      .map((proposal) => [proposal.taskId, proposal]),
  );
  const myTaskCount = published.filter((task) =>
    teamProposals.has(task.id),
  ).length;
  const band = READINESS_FILTERS.find(
    (filter) => filter.value === readinessFilter,
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visible = published
    .map((task) => ({ task, score: calculateScore(task) }))
    .filter(
      ({ task, score }) =>
        (view === "all" || teamProposals.has(task.id)) &&
        `${task.title} ${task.company} ${task.industry}`
          .toLocaleLowerCase("ru")
          .includes(normalizedQuery) &&
        (industry === "all" || task.industry === industry) &&
        (!band || (score >= band.min && score <= band.max)),
    )
    .sort((a, b) => b.score - a.score);
  const hasFilters = Boolean(
    query || industry !== "all" || readinessFilter !== "all",
  );
  const selectedTask = published.find((task) => task.id === selectedTaskId);
  function resetFilters() {
    setQuery("");
    setIndustry("all");
    setReadinessFilter("all");
  }

  return (
    <Sheet
      open={detailsOpen && Boolean(selectedTask)}
      onOpenChange={setDetailsOpen}
    >
      <main
        className="workspace-scroll h-full min-h-0 overflow-y-auto bg-background px-4 py-6 sm:px-8 lg:px-12 lg:py-9"
        aria-labelledby={`${id}-title`}
      >
        <div className="mx-auto max-w-[1280px]">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
            <h1
              id={`${id}-title`}
              className="text-2xl font-semibold tracking-tight"
            >
              Каталог задач
            </h1>
            {teamControl}
          </header>
          <div
            className="mb-5 flex gap-6 border-b"
            role="group"
            aria-label="Какие задачи показать"
          >
            {(
              [
                { value: "all", label: "Все задачи", count: published.length },
                {
                  value: "applications",
                  label: "Мои отклики",
                  count: myTaskCount,
                },
              ] as const
            ).map((item) => (
              <button
                type="button"
                key={item.value}
                aria-pressed={view === item.value}
                onClick={() => setView(item.value)}
                className={cn(
                  "flex items-center gap-2 border-b-2 pb-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  view === item.value
                    ? "border-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span className="text-xs font-normal tabular-nums text-muted-foreground">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Magnifier
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по задачам и компаниям"
                aria-label="Поиск по задачам, компаниям и темам"
                className="h-10 rounded-lg border-border bg-background pl-9 pr-9 text-sm shadow-none"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2"
                  aria-label="Очистить поиск"
                  onClick={() => setQuery("")}
                >
                  <Xmark className="size-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger
                  aria-label="Тема задачи"
                  className="h-10 w-full data-[size=default]:h-10 sm:w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все темы</SelectItem>
                  {industries.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={readinessFilter}
                onValueChange={setReadinessFilter}
              >
                <SelectTrigger
                  aria-label="Готовность задачи"
                  className="h-10 w-full data-[size=default]:h-10 sm:w-56"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Любая готовность</SelectItem>
                  {READINESS_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.min}–{filter.max} · {readiness(filter.min).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-5 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span role="status">
              Показано {visible.length} из{" "}
              {view === "all" ? published.length : myTaskCount}
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-4 text-foreground underline underline-offset-4"
                >
                  Сбросить фильтры
                </button>
              )}
            </span>
            <span>По готовности, от высокой</span>
          </div>
          {visible.length ? (
            <ul aria-label="Задачи бизнеса" className="border-t">
              {visible.map(({ task, score }) => {
                const proposal = teamProposals.get(task.id);
                const state = readiness(score);
                return (
                  <li key={task.id} className="border-b">
                    <button
                      type="button"
                      aria-label={`${task.title} — ${task.company}. Готовность: ${score} из 100, ${state.label.toLowerCase()}.${proposal ? ` ${PROPOSAL_LABELS[proposal.status]}.` : ""} Подробнее`}
                      aria-haspopup="dialog"
                      aria-expanded={detailsOpen && selectedTaskId === task.id}
                      aria-controls={
                        detailsOpen && selectedTaskId === task.id
                          ? `${id}-details`
                          : undefined
                      }
                      onClick={(event) => {
                        lastOpenedCard.current = event.currentTarget;
                        onSelectTask(task.id);
                        setDetailsOpen(true);
                      }}
                      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-5 gap-y-2 px-1 py-5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_120px_20px] sm:items-center sm:px-3 sm:py-6 lg:grid-cols-[170px_minmax(0,1fr)_120px_20px] lg:gap-6"
                    >
                      <span className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-3 lg:col-span-1 lg:block">
                        <span className="text-foreground lg:block lg:text-[13px] lg:font-medium">
                          {task.company}
                        </span>
                        <span className="lg:mt-1.5 lg:block">
                          {task.industry}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] leading-snug font-medium">
                          {task.title}
                        </span>
                        <span className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground sm:line-clamp-1">
                          {task.description || task.fields.need}
                        </span>
                        {proposal && (
                          <span className="mt-2 block text-xs text-foreground/80">
                            {proposal.milestoneConfirmed
                              ? "Этап подтверждён · +10 баллов"
                              : PROPOSAL_LABELS[proposal.status]}
                          </span>
                        )}
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-medium tabular-nums">
                          {score}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            / 100
                          </span>
                        </span>
                        <span className="mt-1.5 block max-w-24 text-[11px] leading-snug text-muted-foreground sm:ml-auto sm:max-w-none">
                          {state.label}
                        </span>
                      </span>
                      <ArrowRight
                        className="hidden size-4 text-muted-foreground group-hover:text-foreground sm:block"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-y py-16 text-center">
              <h2 className="text-base font-medium">
                {view === "applications" && !hasFilters
                  ? "У команды пока нет откликов"
                  : "Задачи не найдены"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {view === "applications" && !hasFilters
                  ? "Выберите задачу и отправьте своё предложение."
                  : "Попробуйте изменить запрос или фильтры."}
              </p>
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  resetFilters();
                  if (!hasFilters) setView("all");
                }}
              >
                {hasFilters ? "Сбросить фильтры" : "Все задачи"}
              </Button>
            </div>
          )}
          <p className="mt-5 text-xs text-muted-foreground">
            Любая задача открыта для отклика, независимо от готовности.
          </p>
        </div>
      </main>
      <SheetContent
        id={`${id}-details`}
        side="right"
        showCloseButton={false}
        className="gap-0 border-border bg-background p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[540px] motion-reduce:animate-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          lastOpenedCard.current?.focus();
        }}
      >
        <SheetTitle className="sr-only">
          {selectedTask?.title ?? "Детали задачи"}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Подробности задачи и отклик вашей команды.
        </SheetDescription>
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <span className="text-xs text-muted-foreground">Каталог задач</span>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Закрыть детали задачи"
            >
              <Xmark className="size-4" />
            </Button>
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
