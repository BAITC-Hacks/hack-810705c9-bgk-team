"use client";

import {
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Store,
  Users,
  ArrowUpRight,
  SearchX,
} from "lucide-react";
import {
  calculateScore,
  type Role,
  type Task,
  type Team,
} from "@/entities/workspace";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

type Props = {
  role: Role;
  tasks: Task[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  query: string;
  onQuery: (query: string) => void;
  status: "published" | "draft";
  onStatus: (status: "published" | "draft") => void;
  industry: string;
  onIndustry: (industry: string) => void;
  readinessFilter: string;
  onReadiness: (readiness: string) => void;
  teams: Team[];
  activeTeamId: string;
  onTeam: (id: string) => void;
  points: number;
};

export function TaskNavigation(props: Props) {
  const {
    role,
    tasks,
    selectedId,
    onSelect,
    onCreate,
    query,
    onQuery,
    status,
    onStatus,
    teams,
    activeTeamId,
    onTeam,
  } = props;
  const published = tasks.filter((task) => task.status === "published");
  const drafts = tasks.filter((task) => task.status === "draft");
  const industries = [...new Set(published.map((task) => task.industry))];
  const visible = tasks
    .filter((task) => {
      const score = calculateScore(task);
      return (
        task.status === (role === "student" ? "published" : status) &&
        `${task.title} ${task.company} ${task.industry}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (role !== "student" ||
          !props.industry ||
          task.industry === props.industry) &&
        (role !== "student" ||
          !props.readinessFilter ||
          (props.readinessFilter === "priority"
            ? score >= 90
            : props.readinessFilter === "ready"
              ? score >= 70 && score < 90
              : props.readinessFilter === "working"
                ? score >= 40 && score < 70
                : score < 40))
      );
    })
    .sort((a, b) =>
      role === "student" ? calculateScore(b) - calculateScore(a) : 0,
    );
  return (
    <aside
      className="workspace-panel flex flex-col bg-[#f7f7fa]"
      aria-label={role === "business" ? "Мои задачи" : "Каталог задач"}
    >
      <div className="px-4 pt-5 pb-3">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {role === "business" ? "Мои задачи" : "Каталог задач"}
          </h2>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {role === "business" ? tasks.length : published.length}
          </span>
        </div>
        {role === "business" && (
          <Button
            variant="outline"
            className="mb-4 h-9 w-full border-primary/35 bg-transparent text-primary hover:bg-primary/5"
            onClick={onCreate}
          >
            <Plus className="size-4" />
            Новая задача
          </Button>
        )}
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Найти задачу…"
            aria-label="Найти задачу"
            className="h-9 border-transparent bg-black/[.025] pl-8 text-xs shadow-none focus-visible:bg-white"
          />
        </div>
        {role === "business" ? (
          <div className="mt-4 flex gap-4 border-b" aria-label="Статус задач">
            {(
              [
                ["published", "Активные", published.length],
                ["draft", "Черновики", drafts.length],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => onStatus(value)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  status === value
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {count}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <SlidersHorizontal className="size-3" />
              По готовности, от высокой
            </div>
            <select
              aria-label="Тема задачи"
              value={props.industry}
              onChange={(event) => props.onIndustry(event.target.value)}
              className="h-8 w-full rounded-md border bg-white px-2 text-xs outline-primary"
            >
              <option value="">Все темы</option>
              {industries.map((industry) => (
                <option key={industry}>{industry}</option>
              ))}
            </select>
            <select
              aria-label="Уровень готовности"
              value={props.readinessFilter}
              onChange={(event) => props.onReadiness(event.target.value)}
              className="h-8 w-full rounded-md border bg-white px-2 text-xs outline-primary"
            >
              <option value="">Любая готовность</option>
              <option value="priority">90–100 · Приоритетные</option>
              <option value="ready">70–89 · Готовые</option>
              <option value="working">40–69 · Рабочие</option>
              <option value="draft">0–39 · Нужно уточнить</option>
            </select>
          </div>
        )}
      </div>
      <nav
        className="workspace-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3"
        aria-label="Список задач"
      >
        {visible.map((task) => {
          const score = calculateScore(task);
          return (
            <button
              type="button"
              key={task.id}
              onClick={() => onSelect(task.id)}
              aria-current={selectedId === task.id ? "true" : undefined}
              className={cn(
                "group flex w-full items-start gap-2.5 rounded-lg px-3 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                selectedId === task.id
                  ? "bg-[#eeebf8] text-[#4e418b]"
                  : "hover:bg-white/85",
              )}
            >
              <FileText
                strokeWidth={1.65}
                className={cn(
                  "mt-0.5 size-[17px] shrink-0",
                  selectedId === task.id
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[12.5px] leading-[1.55] font-medium">
                  {task.title}
                </span>
                <span className="mt-1 block truncate text-[10.5px] text-muted-foreground">
                  {role === "student" ? task.company : task.industry}
                </span>
              </span>
              <span
                title={`Готовность: ${score} из 100`}
                className={cn(
                  "mt-0.5 text-[11px] tabular-nums",
                  selectedId === task.id
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                {score}
              </span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            <SearchX className="mx-auto mb-3 size-6 opacity-50" />
            <p>Задачи не найдены</p>
            <p className="mt-1 leading-relaxed">Измените запрос или фильтры.</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                onQuery("");
                props.onIndustry("");
                props.onReadiness("");
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        )}
      </nav>
      {role === "student" && (
        <p className="px-4 pb-3 text-[10px] leading-relaxed text-muted-foreground">
          Все опубликованные задачи открыты для отклика, независимо от рейтинга.
        </p>
      )}
      <div className="mx-4 border-t py-4">
        {role === "business" ? (
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white">
              <Store className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">Бизнес-пространство</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Все демо-публикации
              </p>
            </div>
            <ArrowUpRight className="size-3.5 text-muted-foreground" />
          </div>
        ) : (
          <div>
            <label
              htmlFor="active-team"
              className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground"
            >
              <Users className="size-3.5" />
              Моя команда{" "}
              <span className="ml-auto text-primary">
                {props.points} баллов
              </span>
            </label>
            <select
              id="active-team"
              value={activeTeamId}
              onChange={(event) => onTeam(event.target.value)}
              className="h-9 w-full rounded-lg border bg-white px-2 text-xs outline-primary"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </aside>
  );
}
