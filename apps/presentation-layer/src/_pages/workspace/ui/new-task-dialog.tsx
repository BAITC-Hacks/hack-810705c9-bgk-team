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

export function NewTaskDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (description: string) => void;
}) {
  const [description, setDescription] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          onSubmit={(event) => {
            event.preventDefault();
            if (description.trim().length < 10) return;
            onCreate(description.trim());
            setDescription("");
            onOpenChange(false);
          }}
        >
          <label htmlFor="new-task-description" className="sr-only">
            Описание новой задачи
          </label>
          <Textarea
            id="new-task-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Например, каждый вечер в нашей пекарне остаётся непроданная выпечка. Хотим понять, сколько готовить…"
            className="min-h-36 resize-none bg-muted/40 p-3 text-sm leading-relaxed"
            required
            minLength={10}
            maxLength={4000}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              Черновик виден только бизнесу
            </span>
            <Button
              type="submit"
              disabled={description.trim().length < 10}
              className="h-9"
            >
              Создать черновик
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
