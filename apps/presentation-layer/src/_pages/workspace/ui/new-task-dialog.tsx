"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAsyncAction } from "@/shared/hooks/use-async-action";

export function NewTaskDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (description: string) => void | Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const { pending, error, run } = useAsyncAction();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent className="p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Новая задача
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Опишите проблему. Ассистент поможет уточнить детали.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (description.trim().length < 20) return;
            if (!await run(() => onCreate(description.trim()))) return;
            setDescription("");
            onOpenChange(false);
          }}
        >
          <label htmlFor="new-task-description" className="sr-only">
            Описание новой задачи
          </label>
          <Textarea
            id="new-task-description"
            disabled={pending}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Например, каждый вечер в нашей пекарне остаётся непроданная выпечка. Хотим понять, сколько готовить…"
            className="min-h-36 resize-none bg-muted/40 p-3 text-sm leading-relaxed"
            required
            minLength={20}
            maxLength={2000}
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              Черновик виден только бизнесу
            </span>
            <Button
              type="submit"
              disabled={pending || description.trim().length < 20}
              className="h-9"
            >
              {pending ? "Создаём…" : "Создать черновик"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
