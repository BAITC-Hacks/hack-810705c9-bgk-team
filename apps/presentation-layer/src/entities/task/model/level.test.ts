import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LEVEL_LABELS, levelOf, levelRange, type Level } from "./level";

describe("уровни", () => {
  it("границы 0–39 / 40–69 / 70–89 / 90–100", () => {
    const cases: [number, Level][] = [
      [0, "draft"],
      [39, "draft"],
      [40, "working"],
      [69, "working"],
      [70, "ready"],
      [89, "ready"],
      [90, "priority"],
      [100, "priority"],
    ];
    for (const [value, level] of cases) assert.equal(levelOf(value), level);
  });

  it("levelRange согласован с levelOf", () => {
    for (const level of Object.keys(LEVEL_LABELS) as Level[]) {
      const { min, max } = levelRange(level);
      assert.equal(levelOf(min), level);
      assert.equal(levelOf(max), level);
    }
    assert.deepEqual(levelRange("working"), { min: 40, max: 69 });
  });

  it("русские названия", () => {
    assert.deepEqual(LEVEL_LABELS, {
      draft: "Черновик",
      working: "Рабочая",
      ready: "Готовая",
      priority: "Приоритетная",
    });
  });
});
