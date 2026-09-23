"use client";

import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export type TaskActionHandlers = {
  onRespond: () => void;
  onSkip: () => void;
  onMissing: () => void;
};

/** Три действия колоды и плитки сетки (FR-5.7, FR-5.13). */
export function TaskActions({
  onRespond,
  onSkip,
  onMissing,
  pending,
  size = "sm",
}: TaskActionHandlers & { pending?: boolean; size?: "sm" | "default" }) {
  return (
    <>
      <Button size={size} className="h-10 flex-1 rounded-xl font-semibold" onClick={onRespond}>
        Откликнуться <ArrowRight data-icon="inline-end" />
      </Button>
      <Button size={size} className="h-10 rounded-xl font-semibold" variant="outline" disabled={pending} onClick={onSkip}>
        <ArrowLeft data-icon="inline-start" /> Не сейчас
      </Button>
      <Button size={size} className="h-9 w-full rounded-xl text-xs text-muted-foreground" variant="ghost" disabled={pending} onClick={onMissing}>
        <ArrowUp data-icon="inline-start" /> Не хватает сведений
      </Button>
    </>
  );
}
