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
      <Button size={size} onClick={onRespond}>
        Откликнуться <ArrowRight data-icon="inline-end" />
      </Button>
      <Button size={size} variant="outline" disabled={pending} onClick={onSkip}>
        <ArrowLeft data-icon="inline-start" /> Не сейчас
      </Button>
      <Button size={size} variant="ghost" disabled={pending} onClick={onMissing}>
        <ArrowUp data-icon="inline-start" /> Не хватает сведений
      </Button>
    </>
  );
}
