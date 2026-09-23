"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Layers } from "lucide-react";
import { toast } from "sonner";
import { setViewMode } from "@/features/recommendations/api/set-view-mode";
import { useSwipe } from "@/features/swipe/ui/use-swipe";
import type {
  RecommendationItem,
  RecommendationsResponse,
  ViewMode,
} from "@/shared/api/contracts/task-match";
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
    router.push(`/task-match?task=${item.task.id}`);
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div>
          <p className="text-sm font-semibold">Подборка для вашей команды</p>
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">Доступно задач: {items.length}</p>
        </div>
        <ToggleGroup
          type="single"
          variant="default"
          className="rounded-xl bg-muted p-1"
          value={view}
          onValueChange={(value) => value && changeView(value as ViewMode)}
          aria-label="Вид рекомендаций"
        >
          <ToggleGroupItem value="deck" className="rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-card data-[state=on]:shadow-sm">
            <Layers /> Колода
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" className="rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-card data-[state=on]:shadow-sm">
            <LayoutGrid /> Сетка
          </ToggleGroupItem>
        </ToggleGroup>

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
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold tracking-tight">Рекомендаций пока нет</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Посмотрите общий каталог — откликнуться можно и на задачи за пределами подборки.</p>
          <Link className="mt-5 rounded-lg text-sm font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" href="/catalog">
            Перейти в каталог · {initial.catalogRemainder}
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
