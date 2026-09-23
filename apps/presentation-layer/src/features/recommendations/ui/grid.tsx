"use client";

import { useState } from "react";
import { TaskTile } from "@/entities/task/ui/task-tile";
import { fitPercent } from "@/entities/team";
import { sortGridItems, type GridSort } from "@/features/recommendations/model/rank";
import type { RecommendationItem } from "@/shared/api/contracts/task-match";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";
import { TaskActions } from "./task-actions";

const SORT_OPTIONS: { value: GridSort; label: string }[] = [
  { value: "default", label: "По умолчанию" },
  { value: "fit", label: "По совпадению" },
  { value: "score", label: "По рейтингу" },
];

type Props = {
  items: RecommendationItem[];
  pending: boolean;
  onRespond: (item: RecommendationItem) => void;
  onSkip: (item: RecommendationItem) => void;
  onMissing: (item: RecommendationItem) => void;
};

/** Сетка: тот же набор, что и колода; сортировка только переупорядочивает (FR-5.12–5.14). */
export function Grid({ items, pending, onRespond, onSkip, onMissing }: Props) {
  const [sort, setSort] = useState<GridSort>("default");
  const sorted = sortGridItems(items, sort);

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={sort}
        onValueChange={(value) => value && setSort(value as GridSort)}
        aria-label="Сортировка"
      >
        {SORT_OPTIONS.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((item) => (
          <TaskTile
            key={item.task.id}
            task={item.task}
            fit={{
              percent: fitPercent(item.fit.value),
              explanation: item.explanation,
            }}
            actions={
              <TaskActions
                pending={pending}
                onRespond={() => onRespond(item)}
                onSkip={() => onSkip(item)}
                onMissing={() => onMissing(item)}
              />
            }
          />
        ))}
      </div>
    </div>
  );
}
