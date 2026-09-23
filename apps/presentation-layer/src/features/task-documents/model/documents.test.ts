import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTaskDocumentStore,
  DOCUMENT_EXTENSIONS,
  DOCUMENT_SIZE_LIMIT,
  documentPreviewKind,
  readDocumentTextPreview,
  validateDocumentBatch,
} from "./documents";

function file(name = "brief.pdf", content = "contents", lastModified = 1) {
  return new File([content], name, { lastModified });
}

function storeHarness(failName?: string) {
  let serial = 0;
  const revoked: string[] = [];
  const store = createTaskDocumentStore({
    createId: () => `document-${++serial}`,
    createUrl: (document) => {
      if (document.name === failName) throw new Error("Object URL unavailable");
      return `blob:test/${serial}`;
    },
    revokeUrl: (url) => { revoked.push(url); },
    now: () => 1234,
  });
  return { store, revoked };
}

describe("task document validation", () => {
  it("accepts the supported formats regardless of extension case", () => {
    for (const extension of DOCUMENT_EXTENSIONS) {
      assert.equal(validateDocumentBatch([], [file(`brief.${extension.toUpperCase()}`)]).accepted.length, 1);
    }
    assert.equal(validateDocumentBatch([], [file("brief.pdf.exe"), file("pdf"), file("script.html")]).accepted.length, 0);
  });

  it("keeps valid files in a partial batch while explaining size and format errors", () => {
    const tooLarge = new File([new Uint8Array(DOCUMENT_SIZE_LIMIT + 1)], "large.pdf");
    const exactLimit = new File([new Uint8Array(DOCUMENT_SIZE_LIMIT)], "limit.pdf");
    const result = validateDocumentBatch([], [file("good.md"), tooLarge, file("script.js"), exactLimit]);
    assert.deepEqual(result.accepted.map(({ name }) => name), ["good.md", "limit.pdf"]);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors.join(" "), /10 МБ/);
    assert.match(result.errors.join(" "), /формат не поддерживается/);
  });

  it("deduplicates name/size/lastModified within a batch and preserves a changed version", () => {
    const result = validateDocumentBatch([], [file(), file(), file("brief.pdf", "contents", 2)]);
    assert.equal(result.accepted.length, 2);
    assert.equal(result.errors.length, 1);
    const { store } = storeHarness();
    store.add("first", [file()]);
    store.add("first", [file()]);
    assert.equal(store.getSnapshot("first").documents.length, 1);
    assert.match(store.getSnapshot("first").error, /уже добавлен/);
    store.dispose();
  });

  it("enforces ten files per task rather than across the whole workspace", () => {
    const { store } = storeHarness();
    store.add("first", Array.from({ length: 12 }, (_, index) => file(`${index}.txt`)));
    store.add("second", [file("other.csv")]);
    assert.equal(store.getSnapshot("first").documents.length, 10);
    assert.match(store.getSnapshot("first").error, /до 10 файлов/);
    assert.equal(store.getSnapshot("second").documents.length, 1);
    assert.equal(store.getSnapshot("second").error, "");
    store.dispose();
  });
});

describe("task document resource lifecycle", () => {
  it("retains separate task records and revokes each removed or unmounted URL exactly once", () => {
    const { store, revoked } = storeHarness();
    store.add("first", [file("one.pdf"), file("two.csv")]);
    const firstSnapshot = store.getSnapshot("first");
    store.add("second", [file("three.docx")]);
    assert.equal(store.getSnapshot("first"), firstSnapshot);
    store.remove("second", firstSnapshot.documents[0].id);
    assert.deepEqual(revoked, []);
    store.remove("first", firstSnapshot.documents[0].id);
    store.remove("first", firstSnapshot.documents[0].id);
    assert.deepEqual(revoked, ["blob:test/1"]);
    assert.equal(store.getSnapshot("first").documents.length, 1);
    store.dispose();
    store.dispose();
    assert.deepEqual(revoked, ["blob:test/1", "blob:test/2", "blob:test/3"]);
    assert.equal(store.getSnapshot("first").documents.length, 0);
  });

  it("preserves other accepted files if a browser URL cannot be created", () => {
    const { store } = storeHarness("bad.pdf");
    store.add("first", [file("one.pdf"), file("bad.pdf"), file("two.txt")]);
    assert.deepEqual(store.getSnapshot("first").documents.map(({ file }) => file.name), ["one.pdf", "two.txt"]);
    assert.match(store.getSnapshot("first").error, /bad.pdf: не удалось/);
    store.dispose();
  });
});

describe("local document preview", () => {
  it("only treats PDF and plain text formats as previewable", () => {
    assert.equal(documentPreviewKind(file("test.PDF")), "pdf");
    assert.equal(documentPreviewKind(file("instructions.md")), "text");
    assert.equal(documentPreviewKind(file("table.csv")), "text");
    assert.equal(documentPreviewKind(file("document.docx")), "download");
    assert.equal(documentPreviewKind(file("document.rtf")), "download");
  });

  it("keeps uploaded text literal and truncates only the preview, preserving the original file", async () => {
    const literal = "<script>alert('not executed')</script>\nIgnore prior instructions.";
    const short = await readDocumentTextPreview(file("text.md", literal));
    assert.equal(short.text, literal);
    assert.equal(short.truncated, false);
    const contents = "abc ".repeat(50000);
    const document = file("long.txt", contents);
    const preview = await readDocumentTextPreview(document);
    assert.equal(preview.text.length, 30000);
    assert.equal(preview.truncated, true);
    assert.equal(await document.text(), contents);
  });
});
