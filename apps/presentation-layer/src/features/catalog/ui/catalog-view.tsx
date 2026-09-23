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
import { NativeSelect, NativeSelectOption } from "@/shared/components/ui/native-select";
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        {selects.map((select) => (
          <div key={select.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`filter-${select.key}`} className="text-xs text-muted-foreground">
              {select.label}
            </Label>
            <NativeSelect
              id={`filter-${select.key}`}
              value={filters[select.key] ?? ""}
              onChange={(event) => setFilter(select.key, event.target.value)}
            >
              <NativeSelectOption value="">Все</NativeSelectOption>
              {select.options.map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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

      {initial.items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          По этим фильтрам задач нет.
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
              task={task}
              actions={
                // FR-4.8: откликнуться можно на задачу с любым рейтингом.
                <Button
                  size="sm"
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
