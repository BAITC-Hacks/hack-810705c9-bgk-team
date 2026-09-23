import type { z } from "zod";

import {
  evaluateRequestSchema,
  evaluateResponseSchema,
  grillRequestSchema,
  grillResponseSchema,
  parseRatingReport,
  type EvaluateRequest,
  type GrillResponse,
} from "./contracts/assistant";
import { getMastraClient } from "./mastra";

const EVALUATE_AGENT_ID = "task-evaluator-agent";
const GRILL_WORKFLOW_ID = "stack1-result-control";
const EVALUATE_TIMEOUT_MS = 45_000;
const GRILL_TIMEOUT_MS = 110_000;

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return Response.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

function zodDetails(issues: z.ZodIssue[]): { path: string; message: string }[] {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Оценка задачи агентом task-evaluator-agent (строгий raw JSON RatingReport).
 * Сбой формата/недоступность AI — не ошибка HTTP: 200 { report: null, error }.
 */
export async function postEvaluate(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "bad_json", "Некорректный JSON в запросе");
  }
  const parsed = evaluateRequestSchema.safeParse(raw);
  if (!parsed.success)
    return errorResponse(
      422,
      "invalid_request",
      "Некорректные данные оценки",
      zodDetails(parsed.error.issues),
    );

  const body = await runEvaluate(parsed.data);
  return Response.json(evaluateResponseSchema.parse(body));
}

async function runEvaluate(input: EvaluateRequest) {
  try {
    const result = await getMastraClient()
      .getAgent(EVALUATE_AGENT_ID)
      .generate(input.taskSummary, {
        memory: { thread: input.threadId, resource: "workspace-business" },
        abortSignal: AbortSignal.timeout(EVALUATE_TIMEOUT_MS),
      });
    const report = parseRatingReport(result.text ?? "");
    if (!report)
      return {
        report: null,
        error: "Оценщик вернул ответ в неожиданном формате, повторите оценку.",
      };
    return { report, error: null };
  } catch (error) {
    console.error("[evaluate] Mastra call failed:", error);
    return { report: null, error: "Оценщик недоступен, попробуйте позже." };
  }
}

/** Шаг воркфлоу прожарки: старт (первый suspend) либо resume с ответами. */
export async function postGrill(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "bad_json", "Некорректный JSON в запросе");
  }
  const parsed = grillRequestSchema.safeParse(raw);
  if (!parsed.success)
    return errorResponse(
      422,
      "invalid_request",
      "Некорректные данные прожарки",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );

  let response: GrillResponse | null = null;
  try {
    const workflow = getMastraClient().getWorkflow(GRILL_WORKFLOW_ID);
    if (parsed.data.action === "start") {
      const { seedIdea, language } = parsed.data;
      const run = await workflow.createRun();
      const result = await withTimeout(
        run.startAsync({ inputData: { seedIdea, language } }),
        GRILL_TIMEOUT_MS,
      );
      response = normalizeGrillResult(run.runId, result);
    } else {
      const { runId, step, resumeData } = parsed.data;
      const run = await workflow.createRun({ runId });
      const result = await withTimeout(
        run.resumeAsync({ step, resumeData }),
        GRILL_TIMEOUT_MS,
      );
      response = normalizeGrillResult(run.runId, result);
    }
  } catch (error) {
    console.error("[grill] workflow call failed:", error);
    return errorResponse(
      502,
      "grill_unavailable",
      "Прожарка недоступна, Mastra не ответила",
    );
  }

  const checked = grillResponseSchema.safeParse(response);
  if (!checked.success)
    return errorResponse(
      502,
      "grill_bad_response",
      "Прожарка вернула ответ в неожиданном формате",
    );
  return Response.json(checked.data);
}

type GrillRunResult = {
  status?: string;
  suspendPayload?: unknown;
  suspended?: string[][];
  result?: unknown;
  error?: { message?: string } | string;
};

function normalizeGrillResult(runId: string, raw: unknown): GrillResponse {
  const result = raw as GrillRunResult | null | undefined;
  const status = result?.status;
  if (status === "suspended") {
    const suspended: string[][] = result?.suspended ?? [];
    // suspendPayload приходит в виде { "<stepId>": payload } — раскрываем
    // по пути suspended-шага, чтобы UI получал плоский payload.
    let payload = result?.suspendPayload;
    const stepPath = suspended[0];
    if (
      stepPath &&
      payload &&
      typeof payload === "object" &&
      !(payload as Record<string, unknown>).stage &&
      !(payload as Record<string, unknown>).question
    ) {
      const stepId = stepPath[stepPath.length - 1];
      payload =
        (payload as Record<string, unknown>)[stepId] ?? payload;
    }
    return { runId, status: "suspended", payload, suspended };
  }
  if (status === "success")
    return { runId, status: "success", result: result?.result };
  const message =
    typeof result?.error === "string"
      ? result.error
      : result?.error?.message;
  return {
    runId,
    status: "failed",
    error: message ?? "Прожарка завершилась с ошибкой",
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Превышен таймаут ${ms} мс`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
