"use client";

import { Plus, Magnifier, Xmark } from "@gravity-ui/icons";
import { calculateScore, type Task } from "@/entities/workspace";
import { IconAction } from "@/shared/components/icon-action";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

type Props = {
  tasks: Task[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  query: string;
  onQuery: (query: string) => void;
  status: "published" | "draft";
  onStatus: (status: "published" | "draft") => void;
  onClose?: () => void;
};

export function TaskNavigation({
  tasks,
  selectedId,
  onSelect,
  onCreate,
  query,
  onQuery,
  status,
  onStatus,
  onClose,
}: Props) {
  const published = tasks.filter((task) => task.status === "published");
  const drafts = tasks.filter((task) => task.status === "draft");
  const visible = tasks.filter(
    (task) =>
      task.status === status &&
      `${task.title} ${task.company} ${task.industry}`
        .toLocaleLowerCase("ru")
        .includes(query.trim().toLocaleLowerCase("ru")),
  );

  return (
    <aside
      className="workspace-panel flex flex-col bg-workspace-surface"
      aria-label="Мои задачи"
    >
      <div className="px-4 pt-3 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-bold tracking-tight">Мои задачи</h2>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {tasks.length}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconAction label="Новая задача" onClick={onCreate}>
              <Plus className="size-4" aria-hidden="true" />
            </IconAction>
            {onClose ? (
              <IconAction label="Скрыть список задач" shortcut="Alt+1" onClick={onClose}>
                <Xmark className="size-4" aria-hidden="true" />
              </IconAction>
            ) : null}
          </div>
        </div>
        <div className="relative">
          <Magnifier className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Найти задачу…"
            aria-label="Найти задачу"
            className="h-10 border-transparent bg-muted pl-9 text-[13px] shadow-none focus-visible:bg-card"
          />
        </div>
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
                "flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                status === value
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          ))}
        </div>
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
                  ? "bg-workspace-selected text-workspace-selected-foreground"
                  : "hover:bg-card",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm leading-[1.45] font-semibold">
                  {task.title}
                </span>
                <span className="mt-1.5 block truncate text-xs text-muted-foreground">
                  {task.industry}
                </span>
              </span>
              <span
                title={`Готовность: ${score} из 100`}
                className="mt-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
              >
                {score}
              </span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            <p>
              {query
                ? "Задачи не найдены"
                : status === "draft"
                  ? "Пока нет черновиков"
                  : "Пока нет публикаций"}
            </p>
            {query ? (
              <Button variant="link" size="sm" onClick={() => onQuery("")}>
                Сбросить поиск
              </Button>
            ) : (
              <Button variant="link" size="sm" onClick={onCreate}>
                Создать задачу
              </Button>
            )}
          </div>
        )}
      </nav>
      <div className="mx-4 flex items-center gap-3 border-t py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Бизнес-пространство</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Все демо-публикации
          </p>
        </div>
      </div>
    </aside>
  );
}
