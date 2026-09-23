import { parseOffice } from "officeparser";
import { CHAT_ATTACHMENT_TEXT_LIMIT } from "@/entities/workspace/chat-contracts";
import { ApiError } from "@/shared/api/errors";

export const EXTRACT_SIZE_LIMIT = 10 * 1024 * 1024;
const EXTRACT_TIMEOUT_MS = 20_000;
const PLAIN_TEXT = new Set(["txt", "md", "csv"]);
const OFFICE = new Set(["pdf", "docx", "xlsx", "pptx", "rtf"]);

export type ExtractedDocument = { name: string; text: string; truncated: boolean };

function extensionOf(name: string) {
  return name.includes(".") ? name.split(".").at(-1)!.toLowerCase() : "";
}

/** Plain text only: no OCR, attachments or network access; archives are size-capped. */
export async function extractDocumentText(file: File, signal?: AbortSignal): Promise<ExtractedDocument> {
  const extension = extensionOf(file.name);
  if (!PLAIN_TEXT.has(extension) && !OFFICE.has(extension)) {
    throw new ApiError(415, "UNSUPPORTED_DOCUMENT", "Из этого формата текст не извлекается. Подойдут PDF, DOCX, XLSX, PPTX, RTF, TXT, MD или CSV.");
  }
  if (file.size > EXTRACT_SIZE_LIMIT) {
    throw new ApiError(413, "DOCUMENT_TOO_LARGE", "Файл больше 10 МБ.");
  }

  let text: string;
  if (PLAIN_TEXT.has(extension)) {
    text = await file.text();
  } else {
    const timeout = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
    try {
      const ast = await parseOffice(Buffer.from(await file.arrayBuffer()), {
        abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        extractAttachments: false,
        ocr: false,
        decompressionLimits: { maxUncompressedBytes: 64 * 1024 * 1024, maxZipEntries: 2000, maxTableCells: 200_000 },
      });
      text = (await ast.to("text", { includeImages: false, textConfig: { preserveLayout: false } })).value;
    } catch {
      // Parser errors can echo document content; keep the response generic.
      throw new ApiError(422, "DOCUMENT_UNREADABLE", "Не удалось прочитать файл. Проверьте, что он не повреждён и не защищён паролем.");
    }
  }

  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    name: file.name,
    text: normalized.slice(0, CHAT_ATTACHMENT_TEXT_LIMIT),
    truncated: normalized.length > CHAT_ATTACHMENT_TEXT_LIMIT,
  };
}
