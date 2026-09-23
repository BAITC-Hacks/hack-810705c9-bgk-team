"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Layers, List } from "lucide-react";
import { toast } from "sonner";
import { setViewMode } from "@/features/recommendations/api/set-view-mode";
import { useSwipe } from "@/features/swipe/ui/use-swipe";
import type {
  RecommendationItem,
  RecommendationsResponse,
  ViewMode,
} from "@/shared/api/contracts/task-match";
import { Button } from "@/shared/components/ui/button";
import { Toaster } from "@/shared/components/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";
import { Deck } from "./deck";
import { Grid } from "./grid";
import { MISSING_BLOCKS, MissingInfoDialog } from "./missing-info-dialog";

type Props = {
  teamId: string;
  initial: RecommendationsResponse;
  view: ViewMode;
};

/** Рекомендации команды: колода и сетка рендерят один и тот же items (T-19). */
export function RecommendationsView({ teamId, initial, view: initialView }: Props) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>(initialView);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [missingFor, setMissingFor] = useState<RecommendationItem | null>(null);
  const [, startTransition] = useTransition();
  const { swipe, pending } = useSwipe();

  // Задача, пропущенная «Не сейчас», исчезает из обоих видов сразу (T-20).
  const items = initial.items.filter((item) => !hidden.has(item.task.id));

  const changeView = (next: ViewMode) => {
    setView(next);
    startTransition(() => setViewMode(next));
  };

  const respond = (item: RecommendationItem) => {
    toast.info(`Отклик на «${item.task.title}»`, {
      description: "Форма отклика — ADR-007",
    });
  };

  const skip = async (item: RecommendationItem) => {
    const ok = await swipe({ teamId, taskId: item.task.id, action: "skip" });
    if (!ok) return;
    setHidden((prev) => new Set(prev).add(item.task.id));
    toast.success("Задача убрана из рекомендаций", {
      description: "В каталоге она остаётся, рейтинг не меняется",
    });
    router.refresh();
  };

  const submitMissing = async (block: string, note: string | undefined) => {
    if (!missingFor) return;
    const ok = await swipe({
      teamId,
      taskId: missingFor.task.id,
      action: "missing",
      block,
      note,
    });
    if (!ok) return;
    const label = MISSING_BLOCKS.find((item) => item.value === block)?.label ?? block;
    toast.success(`Бизнес узнает: не хватает блока «${label}»`);
    setMissingFor(null);
  };

  const handlers = {
    pending,
    onRespond: respond,
    onSkip: skip,
    onMissing: setMissingFor,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(value) => value && changeView(value as ViewMode)}
          aria-label="Вид рекомендаций"
        >
          <ToggleGroupItem value="deck">
            <Layers /> Колода
          </ToggleGroupItem>
          <ToggleGroupItem value="grid">
            <LayoutGrid /> Сетка
          </ToggleGroupItem>
        </ToggleGroup>
        <Button asChild variant="outline">
          <Link href="/catalog">
            <List data-icon="inline-start" /> Все задачи
          </Link>
        </Button>
      </div>

      {view === "deck" ? (
        <Deck
          {...handlers}
          items={items}
          catalogRemainder={initial.catalogRemainder}
          keysEnabled={missingFor === null}
        />
      ) : items.length > 0 ? (
        <Grid {...handlers} items={items} />
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Рекомендаций пока нет.{" "}
          <Link className="text-foreground underline" href="/catalog">
            В каталоге ещё {initial.catalogRemainder} задач
          </Link>
        </div>
      )}

      <MissingInfoDialog
        taskTitle={missingFor?.task.title ?? null}
        pending={pending}
        onClose={() => setMissingFor(null)}
        onSubmit={submitMissing}
      />
      <Toaster position="bottom-center" />
    </div>
  );
}
