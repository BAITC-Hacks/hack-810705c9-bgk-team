"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDownToLine, Eye, File, Paperclip, TrashBin } from "@gravity-ui/icons";
import { Button } from "@/shared/components/ui/button";
import { IconAction } from "@/shared/components/icon-action";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_LIMIT,
  documentExtension,
  documentPreviewKind,
  formatDocumentSize,
  readDocumentTextPreview,
  type TaskDocument,
} from "../model/documents";

type Props = {
  documents: TaskDocument[];
  error: string;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
};

export function TaskDocumentsPanel({ documents, error, onAdd, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const inputId = useId();
  const noticeId = useId();
  const errorId = useId();
  const selected = documents.find(({ id }) => id === previewId);

  useEffect(() => {
    function preventFileNavigation(event: DragEvent) {
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) {
        event.preventDefault();
      }
    }
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  return (
    <section aria-label="Документы задачи" className="flex min-h-0 flex-col gap-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Документы</h2>
          <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">{documents.length} / {DOCUMENT_LIMIT}</span>
        </div>
        <p id={noticeId} className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Документы доступны только в этой вкладке. Содержимое пока не передаётся помощнику.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">После обновления страницы файлы нужно прикрепить заново.</p>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Выбрать документы"
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <button
        type="button"
        aria-controls={inputId}
        aria-describedby={[noticeId, error && errorId].filter(Boolean).join(" ")}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          onAdd(Array.from(event.dataTransfer.files));
        }}
        className={cn("flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary", dragging ? "border-foreground bg-workspace-selected" : "border-input hover:bg-muted/60")}
      >
        <Paperclip className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold">{dragging ? "Отпустите файлы здесь" : "Добавить документы"}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">Перетащите файлы или выберите на устройстве</span>
        <span className="text-[11px] leading-relaxed text-muted-foreground">PDF, DOC(X), XLS(X), PPT(X), TXT, MD, CSV, RTF · до 10 МБ каждый</span>
      </button>

      {error && <p id={errorId} role="alert" className="text-sm leading-relaxed whitespace-pre-line text-destructive">{error}</p>}

      {documents.length ? (
        <ul className="divide-y border-y">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-2 py-3">
              <File className="mr-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <button type="button" onClick={(event) => { previewTriggerRef.current = event.currentTarget; setPreviewId(document.id); }} className="min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-primary">
                <span className="block truncate text-sm font-semibold" title={document.file.name}>{document.file.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{documentExtension(document.file).toUpperCase()} · {formatDocumentSize(document.file.size)}</span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <IconAction label={`Просмотреть ${document.file.name}`} onClick={(event) => { previewTriggerRef.current = event.currentTarget; setPreviewId(document.id); }}><Eye className="size-4" /></IconAction>
                <IconAction label={`Скачать ${document.file.name}`} asChild>
                  <a href={document.url} download={document.file.name}><ArrowDownToLine className="size-4" /></a>
                </IconAction>
                <IconAction label={`Удалить ${document.file.name}`} onClick={() => onRemove(document.id)}><TrashBin className="size-4" /></IconAction>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-center text-sm text-muted-foreground">Добавьте бриф, таблицы или примеры, чтобы держать материалы задачи под рукой.</p>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setPreviewId(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl" onCloseAutoFocus={(event) => {
          if (previewTriggerRef.current?.isConnected) {
            event.preventDefault();
            previewTriggerRef.current.focus();
          }
        }}>
          {selected && <>
            <DialogHeader className="min-w-0 pr-7">
              <DialogTitle className="font-semibold leading-snug break-words">{selected.file.name}</DialogTitle>
              <DialogDescription>Локальный просмотр · {formatDocumentSize(selected.file.size)}</DialogDescription>
            </DialogHeader>
            {documentPreviewKind(selected.file) === "pdf" ? (
              <div className="space-y-2">
                <iframe src={selected.url} title={`Просмотр PDF: ${selected.file.name}`} sandbox="allow-same-origin" className="h-[58dvh] w-full rounded-lg border bg-white" />
                <p className="text-xs text-muted-foreground">Если браузер не показывает PDF, скачайте файл и откройте его на устройстве.</p>
              </div>
            ) : documentPreviewKind(selected.file) === "text" ? (
              <TextDocumentPreview key={selected.id} document={selected} />
            ) : (
              <p className="rounded-lg bg-muted p-5 text-sm leading-relaxed text-muted-foreground">Этот формат удобнее открыть в приложении на устройстве. Скачайте исходный файл для просмотра; его содержимое не обрабатывается помощником.</p>
            )}
            <div className="flex justify-end border-t pt-3">
              <Button asChild variant="outline"><a href={selected.url} download={selected.file.name}><ArrowDownToLine className="size-4" />Скачать исходный файл</a></Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TextDocumentPreview({ document }: { document: TaskDocument }) {
  const [result, setResult] = useState<{ text: string; truncated: boolean } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readDocumentTextPreview(document.file).then((preview) => {
      if (!cancelled) setResult(preview);
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [document.file]);

  if (error) return <p role="alert" className="text-sm text-destructive">Не удалось прочитать файл. Скачайте его для просмотра на устройстве.</p>;
  if (!result) return <p role="status" className="text-sm text-muted-foreground">Открываем текст…</p>;
  return (
    <div className="space-y-2">
      {result.truncated && <p role="status" className="text-xs text-muted-foreground">Предпросмотр сокращён: показано начало файла. Скачивается полный исходный документ.</p>}
      <pre className="max-h-[58dvh] overflow-auto rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">{result.text || "Файл пуст."}</pre>
    </div>
  );
}
