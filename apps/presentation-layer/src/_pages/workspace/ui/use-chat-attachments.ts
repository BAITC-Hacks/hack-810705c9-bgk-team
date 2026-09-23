"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_ATTACHMENT_LIMIT, type ChatAttachment } from "@/entities/workspace";
import { requestError, workspaceApi } from "@/entities/workspace/api";

export const CHAT_ATTACHMENT_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "rtf", "txt", "md", "csv"] as const;
export const CHAT_ATTACHMENT_ACCEPT = CHAT_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",");
const LOCAL_TEXT = new Set(["txt", "md", "csv"]);
const SIZE_LIMIT = 10 * 1024 * 1024;
const TEXT_LIMIT = 10_000;

export type PendingChatAttachment = {
  id: string;
  file: File;
  status: "reading" | "ready" | "error";
  result?: ChatAttachment;
  error?: string;
};

function extensionOf(file: File) {
  return file.name.includes(".") ? file.name.split(".").at(-1)!.toLowerCase() : "";
}

async function readText(taskId: string, file: File): Promise<ChatAttachment> {
  if (!LOCAL_TEXT.has(extensionOf(file))) return workspaceApi.extractDocument(taskId, file);
  const text = (await file.text()).replace(/\r\n?/g, "\n").trim();
  return { name: file.name, text: text.slice(0, TEXT_LIMIT), truncated: text.length > TEXT_LIMIT };
}

/** Files are read as soon as they are attached so sending does not wait on parsing. */
export function useChatAttachments(taskId: string) {
  const [items, setItems] = useState<PendingChatAttachment[]>([]);
  const [notice, setNotice] = useState("");
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const update = useCallback((id: string, patch: Partial<PendingChatAttachment>) => {
    // Results for removed files are dropped instead of reappearing.
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const add = useCallback((files: File[]) => {
    const errors: string[] = [];
    const accepted: PendingChatAttachment[] = [];
    const signatures = new Set(itemsRef.current.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`));
    for (const file of files) {
      const signature = `${file.name}:${file.size}:${file.lastModified}`;
      if (!CHAT_ATTACHMENT_EXTENSIONS.some((extension) => extension === extensionOf(file))) {
        errors.push(`${file.name}: формат не поддерживается. Подойдут PDF, DOCX, XLSX, PPTX, RTF, TXT, MD или CSV.`);
      } else if (file.size > SIZE_LIMIT) {
        errors.push(`${file.name}: файл больше 10 МБ.`);
      } else if (signatures.has(signature)) {
        errors.push(`${file.name}: файл уже прикреплён.`);
      } else if (itemsRef.current.length + accepted.length >= CHAT_ATTACHMENT_LIMIT) {
        errors.push(`${file.name}: к одному сообщению можно прикрепить до ${CHAT_ATTACHMENT_LIMIT} файлов.`);
      } else {
        signatures.add(signature);
        accepted.push({ id: crypto.randomUUID(), file, status: "reading" });
      }
    }
    setNotice(errors.join("\n"));
    if (!accepted.length) return [];
    itemsRef.current = [...itemsRef.current, ...accepted];
    setItems(itemsRef.current);
    for (const item of accepted) {
      readText(taskId, item.file).then(
        (result) => update(item.id, { status: "ready", result }),
        (error) => update(item.id, { status: "error", error: requestError(error) }),
      );
    }
    return accepted.map(({ file }) => file);
  }, [taskId, update]);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setNotice("");
  }, []);

  const reset = useCallback((next: PendingChatAttachment[] = []) => {
    itemsRef.current = next;
    setItems(next);
    setNotice("");
  }, []);

  return {
    items,
    notice,
    reading: items.some(({ status }) => status === "reading"),
    failed: items.some(({ status }) => status === "error"),
    attachments: items.flatMap(({ result }) => (result ? [result] : [])),
    add,
    remove,
    reset,
  };
}
