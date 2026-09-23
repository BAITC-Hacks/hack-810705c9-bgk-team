export type TaskDocument = {
  id: string;
  file: File;
  url: string;
  addedAt: number;
};

export const DOCUMENT_LIMIT = 10;
export const DOCUMENT_SIZE_LIMIT = 10 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv", "rtf"] as const;
export const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",");
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv"]);
const PREVIEW_BYTE_LIMIT = 128 * 1024;
const PREVIEW_CHARACTER_LIMIT = 30000;

export function documentExtension(file: Pick<File, "name">): string {
  return file.name.split(".").at(-1)?.toLowerCase() ?? "";
}

export function documentPreviewKind(file: Pick<File, "name">): "pdf" | "text" | "download" {
  const extension = documentExtension(file);
  return extension === "pdf" ? "pdf" : TEXT_EXTENSIONS.has(extension) ? "text" : "download";
}

export function formatDocumentSize(size: number): string {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}

function documentSignature(file: Pick<File, "name" | "size" | "lastModified">) {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}

export function validateDocumentBatch(existing: TaskDocument[], files: File[]) {
  const accepted: File[] = [];
  const errors: string[] = [];
  const signatures = new Set(existing.map(({ file }) => documentSignature(file)));
  for (const file of files) {
    if (!file.name.includes(".") || !DOCUMENT_EXTENSIONS.some((extension) => extension === documentExtension(file))) {
      errors.push(`${file.name}: этот формат не поддерживается.`);
    } else if (file.size > DOCUMENT_SIZE_LIMIT) {
      errors.push(`${file.name}: размер превышает 10 МБ.`);
    } else if (signatures.has(documentSignature(file))) {
      errors.push(`${file.name}: файл уже добавлен.`);
    } else if (existing.length + accepted.length >= DOCUMENT_LIMIT) {
      errors.push(`${file.name}: к одной задаче можно добавить до 10 файлов.`);
    } else {
      accepted.push(file);
      signatures.add(documentSignature(file));
    }
  }
  return { accepted, errors };
}

export async function readDocumentTextPreview(file: File): Promise<{ text: string; truncated: boolean }> {
  const text = await file.slice(0, PREVIEW_BYTE_LIMIT).text();
  return {
    text: text.slice(0, PREVIEW_CHARACTER_LIMIT),
    truncated: file.size > PREVIEW_BYTE_LIMIT || text.length > PREVIEW_CHARACTER_LIMIT,
  };
}

type DocumentSnapshot = { documents: TaskDocument[]; error: string };
const EMPTY_SNAPSHOT: DocumentSnapshot = { documents: [], error: "" };

type StoreOptions = {
  createUrl?: (file: File) => string;
  revokeUrl?: (url: string) => void;
  createId?: () => string;
  now?: () => number;
};

/** Private, tab-local files: no storage writes, upload, parsing, or assistant calls. */
export function createTaskDocumentStore({
  createUrl = (file) => URL.createObjectURL(documentPreviewKind(file) === "pdf" ? file.slice(0, file.size, "application/pdf") : file),
  revokeUrl = (url) => URL.revokeObjectURL(url),
  createId = () => crypto.randomUUID(),
  now = () => Date.now(),
}: StoreOptions = {}) {
  const records = new Map<string, DocumentSnapshot>();
  const listeners = new Set<() => void>();
  const getSnapshot = (taskId: string) => records.get(taskId) ?? EMPTY_SNAPSHOT;
  function publish(taskId: string, snapshot: DocumentSnapshot) {
    records.set(taskId, snapshot);
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot,
    getServerSnapshot: () => EMPTY_SNAPSHOT,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    add(taskId: string, files: File[]) {
      if (!files.length) return;
      const previous = getSnapshot(taskId).documents;
      const { accepted, errors } = validateDocumentBatch(previous, files);
      const added: TaskDocument[] = [];
      for (const file of accepted) {
        let url: string | undefined;
        try {
          const id = createId();
          url = createUrl(file);
          added.push({ id, file, url, addedAt: now() });
        } catch {
          if (url) revokeUrl(url);
          errors.push(`${file.name}: не удалось открыть файл. Попробуйте добавить его ещё раз.`);
        }
      }
      publish(taskId, { documents: [...previous, ...added], error: errors.join("\n") });
    },
    remove(taskId: string, id: string) {
      const current = getSnapshot(taskId).documents;
      const document = current.find((item) => item.id === id);
      if (!document) return;
      revokeUrl(document.url);
      publish(taskId, { documents: current.filter((item) => item.id !== id), error: "" });
    },
    dispose() {
      for (const { documents } of records.values()) {
        for (const { url } of documents) revokeUrl(url);
      }
      records.clear();
      listeners.clear();
    },
  };
}
