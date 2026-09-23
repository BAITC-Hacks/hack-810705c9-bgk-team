import type { ReactNode } from "react";
import type { Engagement, TaskTile as TaskTileData } from "@/shared/api/contracts/task-match";
import { catalogBadge, LEVEL_LABELS } from "@/entities/task/model/level";
import { ROLE_LABELS } from "@/entities/team/model/types";
import { Badge } from "@/shared/components/ui/badge";
import { NODE_META } from "@/entities/task/model/nodes";
import { cn } from "@/shared/lib/utils";

export const ENGAGEMENT_LABELS: Record<Engagement, string> = {
  paid: "подработка",
  practice: "практика",
  both: "практика и подработка",
};

type Props = {
  task: TaskTileData;
  /** Только в рекомендациях (FR-5.5); каталог его не передаёт (FR-5.15). */
  fit?: { percent: number; explanation: string };
  actions?: ReactNode;
  className?: string;
};

/** Плитка задачи для сетки рекомендаций, колоды и каталога (FR-5.12, FR-5.15). */
export function TaskTile({ task, fit, actions, className }: Props) {
  const badge = catalogBadge(task.score);
  const priority = task.level === "priority";
  const draft = task.level === "draft";

  return (
    <article
      data-level={task.level}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5 text-sm text-card-foreground transition-colors hover:border-foreground/25",
        priority && "border-foreground/30",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug tracking-tight">{task.title}</h3>
          <p className="text-xs text-muted-foreground">{task.company}</p>
        </div>
        {fit && (
          <span className="shrink-0 rounded-lg bg-primary px-2 py-1 text-sm font-semibold text-primary-foreground">
            {fit.percent}%
          </span>
        )}
      </header>

      {fit && <p className="text-xs text-muted-foreground">{fit.explanation}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">
          {LEVEL_LABELS[task.level]} · {task.score}
        </Badge>
        {badge && (
          <Badge
            className={cn(
              priority && "bg-primary text-primary-foreground",
              draft && "bg-destructive/10 text-destructive",
            )}
          >
            {badge}
          </Badge>
        )}
        <Badge variant="secondary">{ENGAGEMENT_LABELS[task.engagement]}</Badge>
      </div>

      {task.neededRoles.length > 0 && (
        <p className="text-xs">
          <span className="text-muted-foreground">Нужны: </span>
          {task.neededRoles.map((role) => ROLE_LABELS[role] ?? role).join(", ")}
        </p>
      )}

      {task.unknown.length > 0 && (
        <div className="rounded-lg bg-muted/60 p-2 text-xs">
          <p className="font-medium">Пока неизвестно</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {task.unknown.map((item) => (
              <li key={item}>{NODE_META[item as keyof typeof NODE_META]?.label ?? ({ context: "Контекст задачи", criteria: "Критерии успеха", data: "Данные и материалы", result: "Ожидаемый результат", constraints: "Сроки и ограничения", users: "Пользователи", link: "Контакт и связь" } as Record<string, string>)[item] ?? item}</li>
            ))}
          </ul>
        </div>
      )}

      {actions && <footer className="mt-auto flex flex-wrap gap-2 border-t pt-4">{actions}</footer>}
    </article>
  );
}
