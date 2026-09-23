import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GRILL_NODES,
  nextStep,
  type GrillField,
  type GrillNode,
  type GrillQuestionNode,
  type GrillSessionState,
} from "./index";

function session(
  overrides: Partial<GrillSessionState> = {},
): GrillSessionState {
  return {
    status: "active",
    currentNode: null,
    currentBlock: null,
    pushbacks: {},
    questionsAsked: 0,
    version: 0,
    askedNodes: [],
    skippedNodes: [],
    ...overrides,
  };
}

function suggested(value: unknown = "Ответ", sourceQuote = "Цитата из ответа"): GrillField {
  return { value, state: "suggested", sourceQuote };
}

describe("nextStep", () => {
  it("задаёт короткому черновику минимум три вопроса", () => {
    let state = session();
    const questions: GrillQuestionNode[] = [];

    for (let index = 0; index < 3; index += 1) {
      const step = nextStep(state, {});
      assert.equal(step.kind, "question");
      if (step.kind !== "question") break;
      questions.push(step.node);
      state = {
        ...state,
        currentNode: step.node,
        questionsAsked: state.questionsAsked + 1,
        askedNodes: [...state.askedNodes, step.node],
      };
    }

    assert.equal(questions.length, 3);
    assert.deepEqual(questions, ["context.current", "context.size", "context.change"]);
  });

  it("не задаёт снова узел, у которого уже есть закрытое поле", () => {
    const closedNode = "context.current" as const;
    const step = nextStep(
      session({ askedNodes: [closedNode] }),
      { [closedNode]: suggested("Текущая ситуация") },
    );

    assert.deepEqual(step, {
      kind: "question",
      node: "context.size",
      isPushback: false,
    });
  });

  it("задаёт только одно уточнение расплывчатому ответу", () => {
    const node = "context.current" as const;
    const base = session({
      currentNode: node,
      pushbacks: { [node]: 0 },
      askedNodes: [node],
      questionsAsked: 1,
    });
    const clarification = nextStep(base, {}, { specificity: "vague", coveredNodes: [], fields: {} });
    assert.deepEqual(clarification, {
      kind: "question",
      node,
      isPushback: true,
    });

    const afterOneClarification = {
      ...base,
      pushbacks: { [node]: 1 as const },
    };
    const accepted = nextStep(afterOneClarification, {}, {
      specificity: "vague",
      coveredNodes: [],
      fields: {},
    });
    assert.deepEqual(accepted, {
      kind: "question",
      node: "context.size",
      isPushback: false,
    });
  });

  it("пропускает объём и пример и спрашивает, кто соберёт данные", () => {
    const beforeDataNodes = GRILL_NODES
      .filter(({ node }) => ["context", "result", "criteria"].includes(node.split(".")[0]))
      .map(({ node }) => node);
    const fields: Partial<Record<GrillNode, GrillField>> = Object.fromEntries(
      [...beforeDataNodes, "data.what"].map((node) => [node, suggested()]),
    );
    const step = nextStep(
      session({
        askedNodes: [...beforeDataNodes, "data.what"],
        questionsAsked: beforeDataNodes.length + 1,
      }),
      fields,
      { specificity: "specific", coveredNodes: [], fields: {}, dataUnavailable: true },
    );

    assert.deepEqual(step, {
      kind: "question",
      node: "data.collection",
      isPushback: false,
    });
    assert.notEqual(step.kind === "question" ? step.node : undefined, "data.volume");
    assert.notEqual(step.kind === "question" ? step.node : undefined, "data.sample");
  });

  it("добавляет профильный вопрос для указанного типа результата", () => {
    const fields: Partial<Record<GrillNode, GrillField>> = Object.fromEntries(
      GRILL_NODES.map(({ node }) => [node, suggested()]),
    );
    const state = session({
      askedNodes: GRILL_NODES.map(({ node }) => node),
      questionsAsked: GRILL_NODES.length,
    });

    const step = nextStep(state, fields, {
      specificity: "specific",
      coveredNodes: [],
      fields: {},
      resultType: "bot",
    });

    assert.deepEqual(step, {
      kind: "question",
      node: "result.profile",
      isPushback: false,
    });
  });

  it("не мутирует сессию, поля и классификацию", () => {
    const state = session({
      currentNode: "context.current",
      pushbacks: { "context.current": 0 },
      askedNodes: ["context.current"],
    });
    const fields = { "context.current": suggested("Коротко") };
    const classification = {
      specificity: "vague" as const,
      coveredNodes: ["context.current" as const],
      fields: {},
      dataUnavailable: true,
    };
    const before = structuredClone({ state, fields, classification });

    nextStep(state, fields, classification);

    assert.deepEqual({ state, fields, classification }, before);
  });
});
