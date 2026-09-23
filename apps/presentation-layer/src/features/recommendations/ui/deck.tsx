"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type TargetAndTransition, type Variants } from "motion/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { TaskTile } from "@/entities/task/ui/task-tile";
import { fitPercent } from "@/entities/team";
import type { RecommendationItem } from "@/shared/api/contracts/task-match";
import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { TaskActions } from "./task-actions";

type Direction = "left" | "right" | "up";

type Props = {
  items: RecommendationItem[];
  catalogRemainder: number;
  pending: boolean;
  /** Клавиши отключаются, пока открыт диалог ↑. */
  keysEnabled: boolean;
  onRespond: (item: RecommendationItem) => void;
  onSkip: (item: RecommendationItem) => void;
  onMissing: (item: RecommendationItem) => void;
};

const EXIT: Record<Direction, TargetAndTransition> = {
  left: { x: -320, rotate: -8, opacity: 0 },
  right: { x: 320, rotate: 8, opacity: 0 },
  up: { y: -40, opacity: 0 },
};
const VARIANTS: Variants = { exit: (dir: Direction) => EXIT[dir] };

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    // Стрелки внутри переключателя вида двигают фокус, а не колоду.
    target.closest('[data-slot="toggle-group"]') !== null
  );
}

/** Колода: одна карточка сверху оставшегося набора (FR-5.5–5.9). */
export function Deck({
  items,
  catalogRemainder,
  pending,
  keysEnabled,
  onRespond,
  onSkip,
  onMissing,
}: Props) {
  // «Откликнуться» только продвигает колоду; «Не сейчас» убирает задачу из items,
  // поэтому следующая карточка занимает ту же позицию.
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState<Direction>("right");
  const current = items[Math.min(position, items.length)] as RecommendationItem | undefined;

  const respond = (item: RecommendationItem) => {
    setDirection("right");
    setPosition((value) => value + 1);
    onRespond(item);
  };
  const skip = (item: RecommendationItem) => {
    setDirection("left");
    onSkip(item);
  };
  const missing = (item: RecommendationItem) => {
    setDirection("up");
    onMissing(item);
  };

  useEffect(() => {
    if (!keysEnabled || !current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowRight") respond(current);
      else if (event.key === "ArrowLeft" && !pending) skip(current);
      else if (event.key === "ArrowUp" && !pending) missing(current);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) {
    return (
      <div className="mx-auto flex min-h-72 w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Вы просмотрели подборку</h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Рекомендации не ограничивают выбор: откликнуться можно на любую задачу.
        </p>
        <Button asChild>
          <Link href="/catalog">
            В каталоге ещё {catalogRemainder} задач <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setPosition(0)}>
            <RotateCcw data-icon="inline-start" /> Пройти колоду заново
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <p className="text-center text-xs font-medium tabular-nums text-muted-foreground">
        {Math.min(position, items.length) + 1} из {items.length}
      </p>
      <div className="relative min-h-72">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={current.task.id}
            custom={direction}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
            variants={VARIANTS}
            exit="exit"
            transition={{ duration: 0.22 }}
          >
            <TaskTile
              className="rounded-2xl border border-border p-5 shadow-none ring-0 sm:p-6"
              task={current.task}
              fit={{
                percent: fitPercent(current.fit.value),
                explanation: current.explanation,
              }}
              actions={
                <TaskActions
                  pending={pending}
                  onRespond={() => respond(current)}
                  onSkip={() => skip(current)}
                  onMissing={() => missing(current)}
                />
              }
            />
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Kbd>←</Kbd> не сейчас <Kbd>→</Kbd> откликнуться <Kbd>↑</Kbd> не хватает сведений
      </p>
    </div>
  );
}
