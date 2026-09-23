import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMentionRange, removeMention } from "./chat-skills";

describe("composer mentions", () => {
  it("recognizes standalone Russian and English skill queries", () => {
    assert.deepEqual(getMentionRange("@готов", 6), {
      start: 0,
      end: 6,
      query: "готов",
    });
    assert.deepEqual(getMentionRange("Проверить @score", 15), {
      start: 10,
      end: 16,
      query: "scor",
    });
    assert.equal(getMentionRange("team@example.com", 12), null);
    assert.equal(getMentionRange("literal@", 8), null);
    assert.equal(getMentionRange("@готовность после", 17), null);
  });

  it("removes only the mention, preserving text and the caret's trailing token", () => {
    const value = "Сначала @готовность затем обсудим";
    const range = getMentionRange(value, 12);
    assert.ok(range);
    assert.equal(removeMention(value, range), "Сначала  затем обсудим");
    assert.equal(getMentionRange("Начало\n@", 8)?.query, "");
  });
});

