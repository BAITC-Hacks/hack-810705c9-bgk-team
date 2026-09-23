import type { MilestoneSubmission, Proposal, Task, Team } from "./model";
import { prepareChatMessages, type ChatAttachment, type ChatMessage } from "./chat-contracts";
import type { OnboardingInput, WorkspaceSession, WorkspaceSnapshot } from "./contracts";
export type { WorkspaceSession, WorkspaceSnapshot } from "./contracts";
export { requestError } from "@/shared/lib/request-error";

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    ...(body === undefined ? {} : body instanceof FormData ? { body } : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result?.error === "string"
      ? result.error
      : result?.error?.message ?? result?.message;
    throw new Error(message || "Сервис временно недоступен. Попробуйте ещё раз.");
  }
  return result as T;
}

const key = encodeURIComponent;

export const workspaceApi = {
  chat: (taskId: string, messages: ChatMessage[]) =>
    request<{ text: string }>(`/tasks/${key(taskId)}/chat`, "POST", { messages: prepareChatMessages(messages) }),
  extractDocument: (taskId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Required<ChatAttachment>>(`/tasks/${key(taskId)}/documents/extract`, "POST", form);
  },
  load: () => request<WorkspaceSnapshot>("/workspace"),
  getSession: () => request<WorkspaceSession>("/session"),
  teams: () => request<Team[]>("/teams"),
  onboard: (input: OnboardingInput) => request<WorkspaceSession>("/onboarding", "POST", input),
  session: (session: Partial<WorkspaceSession>) => request<WorkspaceSession>("/session", "PATCH", session),
  createTask: (description: string) => request<Task>("/workspace/tasks", "POST", { description }),
  saveTask: ({ id, title, company, industry, description, fields, confirmedFields, status, version }: Task) =>
    request<Task>(`/workspace/tasks/${key(id)}`, "PATCH", { title, company, industry, description, fields, confirmedFields, status, version }),
  saveTeam: (team: Team, exists: boolean) => request<Team>(exists ? `/teams/${key(team.id)}` : "/teams", exists ? "PATCH" : "POST", team),
  decide: (id: string, status: Proposal["status"], note?: string) => request<Proposal>(`/workspace/proposals/${key(id)}/decision`, "POST", { status, note }),
  submitMilestone: (id: string, input: MilestoneSubmission) => request<Proposal>(`/workspace/proposals/${key(id)}/milestone`, "PUT", input),
  confirmMilestone: (id: string) => request<Proposal>(`/workspace/proposals/${key(id)}/milestone/confirm`, "POST", {}),
};
