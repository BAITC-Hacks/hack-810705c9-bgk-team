"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { SwipeRequest } from "@/shared/api/contracts/task-match";

/** Обёртка над POST /api/swipes; ошибки показывает тостом. */
export function useSwipe() {
  const [pending, setPending] = useState(false);

  const swipe = useCallback(async (request: SwipeRequest): Promise<boolean> => {
    setPending(true);
    try {
      const response = await fetch("/api/swipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          (body as { error?: { message?: string } } | null)?.error?.message ??
          "Не удалось сохранить действие";
        toast.error(message);
        return false;
      }
      return true;
    } catch {
      toast.error("Нет связи с сервером");
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { swipe, pending };
}
