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
import { NativeSelect, NativeSelectOption } from "@/shared/components/ui/native-select";
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
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(block, note.trim() || undefined);
            setNote("");
          }}
        >
          <DialogHeader>
            <DialogTitle>Не хватает сведений</DialogTitle>
            <DialogDescription>
              {taskTitle}: бизнес увидит, какой блок стоит дополнить.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="missing-block">Блок</Label>
            <NativeSelect
              id="missing-block"
              className="w-full"
              value={block}
              onChange={(event) => setBlock(event.target.value)}
            >
              {MISSING_BLOCKS.map((item) => (
                <NativeSelectOption key={item.value} value={item.value}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="missing-note">Комментарий (необязательно)</Label>
            <Textarea
              id="missing-note"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Например: нет примера данных"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              Отправить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
