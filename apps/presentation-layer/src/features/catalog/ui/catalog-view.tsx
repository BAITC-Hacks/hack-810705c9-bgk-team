"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { LEVEL_LABELS } from "@/entities/task/model/level";
import { ENGAGEMENT_LABELS, TaskTile } from "@/entities/task/ui/task-tile";
import { ROLE_LABELS } from "@/entities/team/model/types";
import type { CatalogQuery, CatalogResponse } from "@/shared/api/contracts/task-match";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Toaster } from "@/shared/components/ui/sonner";
import { cn } from "@/shared/lib/utils";

export const TOPIC_LABELS: Record<string, string> = {
  logistics: "Логистика",
  manufacturing: "Производство",
  education: "Образование",
  retail: "Ритейл",
  "e-commerce": "E-commerce",
};

type Props = {
  initial: CatalogResponse;
  filters: CatalogQuery;
};

type FilterKey = keyof CatalogQuery;

/** Каталог «Все задачи»: все опубликованные задачи без fit (FR-4.3–4.8, FR-5.15). */
export function CatalogView({ initial, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, startTransition] = useTransition();

  const topics = [
    ...new Set([...Object.keys(TOPIC_LABELS), ...initial.items.map((item) => item.topic)]),
  ];

  const setFilter = (key: FilterKey, value: string) => {
    const params = new URLSearchParams();
    for (const [name, current] of Object.entries({ ...filters, [key]: value })) {
      if (current) params.set(name, current);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  };

  const selects: {
    key: FilterKey;
    label: string;
    options: [string, string][];
  }[] = [
    { key: "topic", label: "Тема", options: topics.map((t) => [t, TOPIC_LABELS[t] ?? t]) },
    { key: "level", label: "Уровень", options: Object.entries(LEVEL_LABELS) },
    { key: "role", label: "Роль", options: Object.entries(ROLE_LABELS) },
    { key: "format", label: "Формат", options: Object.entries(ENGAGEMENT_LABELS) },
  ];

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        {selects.map((select) => (
          <div key={select.key} className="flex min-w-36 flex-1 flex-col gap-2">
            <Label htmlFor={`filter-${select.key}`} className="text-xs text-muted-foreground">
              {select.label}
            </Label>
            <Select value={filters[select.key] || "all"} onValueChange={(value) => setFilter(select.key, value === "all" ? "" : value)} disabled={loading}>
              <SelectTrigger id={`filter-${select.key}`} className="h-10 w-full rounded-xl bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {select.options.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        {Object.values(filters).some(Boolean) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.replace(pathname))}
          >
            Сбросить
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground" role="status">
        {loading ? "Обновляем задачи…" : `Задач найдено: ${initial.items.length}`}
      </p>
      {initial.items.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold tracking-tight">Задач пока нет</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Попробуйте изменить фильтры или вернитесь позже — новые задачи появятся здесь.</p>
          {Object.values(filters).some(Boolean) && <Button variant="outline" className="mt-5 rounded-xl" onClick={() => startTransition(() => router.replace(pathname))}>Сбросить фильтры</Button>}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3",
            loading && "opacity-60",
          )}
        >
          {initial.items.map((task) => (
            <TaskTile
              key={task.id}
              className="rounded-2xl border border-border p-5 shadow-none ring-0"
              task={task}
              actions={
                // FR-4.8: откликнуться можно на задачу с любым рейтингом.
                <Button
                  size="sm"
                  className="h-10 w-full rounded-xl font-semibold"
                  onClick={() => {
                    router.push(`/task-match?task=${task.id}`);
                  }}
                >
                  Откликнуться <ArrowRight data-icon="inline-end" />
                </Button>
              }
            />
          ))}
        </div>
      )}
      <Toaster position="bottom-center" />
    </div>
  );
}
