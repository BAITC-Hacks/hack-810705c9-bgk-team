"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

/** Блоки рейтинга (раздел 6.1): slug совпадает с префиксом узла. */
export const MISSING_BLOCKS = [
  { value: "context", label: "Контекст" },
  { value: "data", label: "Данные" },
  { value: "result", label: "Результат" },
  { value: "criteria", label: "Критерии" },
  { value: "constraints", label: "Ограничения" },
  { value: "users", label: "Пользователи" },
  { value: "link", label: "Связь" },
] as const;

type Props = {
  taskTitle: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (block: string, note: string | undefined) => void;
};

/** Свайп ↑ (FR-5.6): команда сообщает бизнесу, какого блока не хватает. */
export function MissingInfoDialog({ taskTitle, pending, onClose, onSubmit }: Props) {
  const [block, setBlock] = useState<string>(MISSING_BLOCKS[0].value);
  const [note, setNote] = useState("");

  return (
    <Dialog open={taskTitle !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(block, note.trim() || undefined);
            setNote("");
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight">Не хватает сведений</DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-relaxed">
              {taskTitle}: бизнес увидит, какой блок стоит дополнить.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="missing-block">Блок</Label>
            <Select value={block} onValueChange={setBlock}>
              <SelectTrigger id="missing-block" className="h-10 w-full rounded-xl bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MISSING_BLOCKS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="missing-note">Комментарий (необязательно)</Label>
            <Textarea
              id="missing-note"
              className="min-h-28 rounded-xl bg-muted/40 text-sm leading-relaxed"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Например: нет примера данных"
            />
          </div>
          <DialogFooter>
            <Button className="h-10 rounded-xl" type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button className="h-10 rounded-xl" type="submit" disabled={pending}>
              {pending ? "Отправляем…" : "Отправить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
