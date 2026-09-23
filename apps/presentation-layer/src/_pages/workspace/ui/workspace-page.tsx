"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  Asterisk,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  List,
  MessageSquare,
  RotateCcw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateScore,
  getDemoData,
  TASK_FIELDS,
  type Message,
  type Proposal,
  type Role,
  type Task,
  type TaskField,
  type WorkspaceData,
} from "@/entities/workspace";
import { TaskEditor } from "@/features/task-editor";
import { TaskInspector } from "@/features/task-inspector";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { Toaster } from "@/shared/components/ui/sonner";
import { cn } from "@/shared/lib/utils";
import { ChatPanel, TaskDetails } from "./chat-panel";
import { NewTaskDialog } from "./new-task-dialog";
import { TaskNavigation } from "./task-navigation";

const COMPACT_QUERY = "(max-width: 1099px)";
function subscribeCompact(onChange: () => void) {
  const media = window.matchMedia(COMPACT_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getCompact = () => window.matchMedia(COMPACT_QUERY).matches;
const getServerCompact = () => false;

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspaceData>(getDemoData);
  const [role, setRole] = useState<Role>("business");
  const [selectedId, setSelectedId] = useState("bakery-waste");
  const [teamId, setTeamId] = useState(() => getDemoData().teams[0].id);
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [tab, setTab] = useState<"assistant" | "card">("assistant");
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [readinessFilter, setReadinessFilter] = useState("");
  const [conversations, setConversations] = useState<Record<string, Message[]>>(
    {},
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, Task>>({});
  const [persistedIds, setPersistedIds] = useState<string[]>([]);
  const [serverQuestions, setServerQuestions] = useState<Record<string, { field: TaskField; question: string }>>({});
  const [resetGeneration, setResetGeneration] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [mobilePane, setMobilePane] = useState<"tasks" | "chat" | "details">(
    "chat",
  );
  const compact = useSyncExternalStore(
    subscribeCompact,
    getCompact,
    getServerCompact,
  );
  useEffect(() => {
    let active = true;
    fetch("/api/tasks")
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить задачи");
        return response.json() as Promise<{
          tasks: Task[];
          questions: Record<string, { field: TaskField; question: string }>;
          proposals: Proposal[];
        }>;
      })
      .then(({ tasks, questions, proposals }) => {
        if (!active) return;
        setPersistedIds(tasks.map((item) => item.id));
        setServerQuestions(questions ?? {});
        if (tasks[0]) setSelectedId(tasks[0].id);
        setData((current) => ({
          ...current,
          tasks: [...tasks, ...current.tasks.filter((item) => !tasks.some((saved) => saved.id === item.id))],
          proposals: [...(proposals ?? []), ...current.proposals.filter((item) => !tasks.some((task) => task.id === item.taskId))],
        }));
      })
      .catch(() => {
        // The bundled fictional tasks remain available when the local database is offline.
      });
    return () => { active = false; };
  }, []);
  const canonicalTask =
    data.tasks.find((item) => item.id === selectedId) ?? data.tasks[0];
  const hasDraftEdits = role === "business" && !!taskDrafts[canonicalTask.id];
  const task =
    role === "business"
      ? (taskDrafts[canonicalTask.id] ?? canonicalTask)
      : canonicalTask;
  const team = data.teams.find((item) => item.id === teamId) ?? data.teams[0];
  const conversationKey = `${role}:${role === "student" ? teamId : "business"}:${task.id}`;
  const messages = conversations[conversationKey] ?? [];
  const points =
    data.proposals.filter(
      (proposal) => proposal.teamId === teamId && proposal.milestoneConfirmed,
    ).length * 10;

  function changeRole(next: Role) {
    setRole(next);
    setTab("assistant");
    setQuery("");
    setIndustry("");
    setReadinessFilter("");
    setStatus("published");
    if (task.status !== "published")
      setSelectedId(
        data.tasks.find((item) => item.status === "published")?.id ?? task.id,
      );
  }

  function selectTask(id: string) {
    setSelectedId(id);
    setTab("assistant");
    setMobilePane("chat");
  }

  async function saveTask(next: Task, verified: boolean) {
    if (persistedIds.includes(next.id)) {
      try {
        const response = await fetch(`/api/tasks/${next.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: next }),
        });
        if (!response.ok) throw new Error("Не удалось сохранить карточку");
        next = (await response.json() as { task: Task }).task;
        if (verified) {
          const confirmed = await fetch(`/api/tasks/${next.id}/grill/checkpoint`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ block: "all", action: "confirm" }),
          });
          if (!confirmed.ok) throw new Error("Не удалось подтвердить сведения");
          next = (await confirmed.json() as { task: Task }).task;
        }
      } catch {
        toast.error("Не удалось сохранить карточку");
        return;
      }
    }
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === next.id ? next : item)),
    }));
    setTaskDrafts((current) => {
      const remaining = { ...current };
      delete remaining[next.id];
      return remaining;
    });
    setStatus(next.status);
    if (task.status === "draft" && next.status === "published") {
      toast.success("Задача опубликована", {
        description: "Переключитесь в роль студента — карточка уже в каталоге.",
      });
    } else
      toast.success("Карточка обновлена", {
        description: `Готовность: ${calculateScore(next)} из 100.`,
      });
  }

  async function sendMessage(text: string, field?: TaskField) {
    if (role === "business" && persistedIds.includes(task.id)) {
      try {
        const response = await fetch(`/api/tasks/${task.id}/grill/turn`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answer: text }),
        });
        if (!response.ok) throw new Error("Не удалось сохранить ответ");
        const result = await response.json() as {
          task: Task;
          question: { field: TaskField; question: string } | null;
        };
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((item) => item.id === result.task.id ? result.task : item),
        }));
        setServerQuestions((current) => {
          const updated = { ...current };
          if (result.question) updated[task.id] = result.question;
          else delete updated[task.id];
          return updated;
        });
        setConversations((current) => ({
          ...current,
          [conversationKey]: [
            ...(current[conversationKey] ?? []),
            { id: crypto.randomUUID(), role: "user", content: text },
            { id: crypto.randomUUID(), role: "assistant", content: result.question
              ? `Ответ сохранён в карточке. Следующий вопрос: ${result.question.question}`
              : "Ответ сохранён. Проверьте карточку и подтвердите сведения перед публикацией." },
          ],
        }));
      } catch {
        toast.error("Не удалось сохранить ответ. Попробуйте ещё раз.");
      }
      return;
    }
    let response = "";
    if (role === "business" && field) {
      const label = TASK_FIELDS.find((item) => item.key === field)?.label;
      const update = (item: Task): Task => ({
        ...item,
        fields: { ...item.fields, [field]: text },
        confirmedFields: item.confirmedFields.filter((key) => key !== field),
      });
      if (task.status === "published") {
        setTaskDrafts((current) => ({
          ...current,
          [task.id]: update(current[task.id] ?? canonicalTask),
        }));
      } else {
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((item) =>
            item.id === task.id ? update(item) : item,
          ),
        }));
      }
      response = `Добавила ваш ответ в поле «${label}» без изменений.\n\nОткройте карточку, проверьте текст и подтвердите сведения — после этого пересчитается рейтинг.`;
    } else if (role === "business") {
      response =
        "Уточнение осталось в этой беседе. В демо-режиме выберите один из вопросов выше, чтобы записать ответ в нужное поле, или откройте «Карточку задачи».\n\nЯ не добавляю неподтверждённые факты и не публикую задачу за вас.";
    } else {
      const normalized = text.toLocaleLowerCase("ru");
      if (/данн|материал|источник/.test(normalized))
        response =
          task.fields.data ||
          "Бизнес пока не описал доступные данные. Укажите в своём предложении, что понадобится для проверки идеи.";
      else if (/оцен|успех|критери|метрик/.test(normalized))
        response =
          task.fields.success ||
          "Критерии успеха ещё не указаны. Предложите измеримый результат и согласуйте его с бизнесом.";
      else if (/срок|огранич|технол/.test(normalized))
        response =
          task.fields.constraints ||
          "Сроки и ограничения пока не указаны. Вы можете предложить их в отклике.";
      else if (/контакт|связ|встреч/.test(normalized))
        response =
          [task.fields.contact, task.fields.interaction]
            .filter(Boolean)
            .join("\n\n") ||
          "Контакт ещё не указан. Этот вопрос можно добавить в отклик.";
      else
        response = `По карточке бизнеса ожидаемый результат:\n${task.fields.outcome || task.fields.need || task.description}\n\nВ демонстрации я могу показать сведения о данных, сроках и критериях успеха. Для отклика нажмите «Предложить решение» справа.`;
    }
    setConversations((current) => ({
      ...current,
      [conversationKey]: [
        ...(current[conversationKey] ?? []),
        { id: crypto.randomUUID(), role: "user", content: text },
        { id: crypto.randomUUID(), role: "assistant", content: response },
      ],
    }));
  }

  function resetDemo() {
    const next = getDemoData();
    setData((current) => ({
      ...next,
      tasks: [...current.tasks.filter((item) => persistedIds.includes(item.id)), ...next.tasks],
      proposals: [...current.proposals.filter((item) => persistedIds.includes(item.taskId)), ...next.proposals],
    }));
    setConversations({});
    setTaskDrafts({});
    setResetGeneration((current) => current + 1);
    setShowCreate(false);
    setRole("business");
    setSelectedId(next.tasks[0].id);
    setTeamId(next.teams[0].id);
    setQuery("");
    setIndustry("");
    setReadinessFilter("");
    setStatus("published");
    setTab("assistant");
    setShowDemo(false);
    setMobilePane("chat");
    toast.success("Демонстрация начата заново");
  }

  const navigation = (
    <TaskNavigation
      role={role}
      tasks={data.tasks}
      selectedId={task.id}
      onSelect={selectTask}
      onCreate={() => setShowCreate(true)}
      query={query}
      onQuery={setQuery}
      status={status}
      onStatus={(next) => {
        setStatus(next);
        setQuery("");
        const first = data.tasks.find((item) => item.status === next);
        if (first) selectTask(first.id);
      }}
      industry={industry}
      onIndustry={setIndustry}
      readinessFilter={readinessFilter}
      onReadiness={setReadinessFilter}
      teams={data.teams}
      activeTeamId={teamId}
      onTeam={setTeamId}
      points={points}
    />
  );
  const center = (
    <main
      className="workspace-panel flex flex-col bg-white"
      aria-label="Работа с задачей"
    >
      <div className="shrink-0 px-6 pt-5 lg:px-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{task.industry}</span>
              <span className="text-border">/</span>
              <span className="truncate">{task.company}</span>
            </div>
            <h1 className="text-[20px] leading-snug font-semibold tracking-[-.6px] xl:text-[23px]">
              {task.title}
            </h1>
          </div>
          <span
            className={cn(
              "mt-0.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[9px] font-medium",
              task.status === "published" && !hasDraftEdits
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700",
            )}
          >
            <span
              className={cn(
                "size-1 rounded-full",
                task.status === "published" && !hasDraftEdits
                  ? "bg-emerald-500"
                  : "bg-amber-500",
              )}
            />
            {hasDraftEdits
              ? "Есть изменения"
              : task.status === "published"
                ? "Опубликована"
                : "Черновик"}
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Содержание задачи"
          className="mt-5 flex gap-6 border-b"
        >
          {(
            [
              ["assistant", "Ассистент"],
              ["card", "Карточка задачи"],
            ] as const
          ).map(([value, label]) => (
            <button
              id={`tab-${value}`}
              role="tab"
              type="button"
              key={value}
              aria-selected={tab === value}
              aria-controls="task-content"
              tabIndex={tab === value ? 0 : -1}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  const next = tab === "assistant" ? "card" : "assistant";
                  setTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              onClick={() => setTab(value)}
              className={cn(
                "border-b-2 px-0.5 pt-1 pb-3 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                tab === value
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          {role === "business" && tab === "assistant" && (
            <button
              type="button"
              onClick={() => setTab("card")}
              className="ml-auto mb-2 hidden items-center gap-1 text-[10px] text-primary xl:flex"
            >
              {task.status === "draft" ? "К публикации" : "Улучшить"}
              <ArrowUpRight className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div
        id="task-content"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === "assistant" ? (
          <ChatPanel
            key={`${role}:${task.id}:${teamId}`}
            role={role}
            task={task}
            messages={messages}
            currentQuestion={persistedIds.includes(task.id) ? (serverQuestions[task.id] ?? null) : undefined}
            onSend={sendMessage}
            onEdit={() => setTab("card")}
          />
        ) : role === "business" ? (
          <TaskEditor
            key={task.id}
            task={task}
            savedTask={canonicalTask}
            onSave={saveTask}
            onCancel={() => setTab("assistant")}
          />
        ) : (
          <TaskDetails task={task} />
        )}
      </div>
    </main>
  );
  const inspector = (
    <div className="workspace-panel bg-[#f8f8fa]">
      <TaskInspector
        role={role}
        task={task}
        teams={data.teams}
        proposals={data.proposals}
        activeTeamId={teamId}
        canUndoDecision={!persistedIds.includes(task.id)}
        onEditTask={() => {
          setTab("card");
          setMobilePane("chat");
        }}
        onDecision={async (id, decision, reason) => {
          if (persistedIds.includes(task.id)) {
            try {
              const response = await fetch(`/api/proposals/${id}/decision`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ decision: decision === "selected" ? "select" : decision === "rejected" ? "reject" : "defer", reason }),
              });
              if (!response.ok) throw new Error("Решение не сохранено");
              const result = await response.json() as { proposal: Proposal };
              setData((current) => ({
                ...current,
                proposals: current.proposals.map((proposal) => proposal.id === id ? result.proposal : proposal),
              }));
            } catch {
              toast.error("Не удалось сохранить решение");
            }
            return;
          }
          setData((current) => ({
            ...current,
            proposals: current.proposals.map((proposal) =>
              proposal.id === id ? { ...proposal, status: decision } : proposal,
            ),
          }));
          toast.success(
            decision === "selected"
              ? "Команда выбрана"
              : decision === "rejected"
                ? "Предложение отклонено"
                : "Решение отменено",
            {
              description:
                decision === "selected"
                  ? "Можно продолжить просмотр и выбрать ещё одну команду."
                  : "Отклик остаётся в списке.",
            },
          );
        }}
        onApply={async (input) => {
          if (persistedIds.includes(task.id)) {
            try {
              const response = await fetch(`/api/tasks/${task.id}/proposals`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ ...input, teamId }),
              });
              if (!response.ok) throw new Error("Отклик не сохранён");
              const { proposal } = await response.json() as { proposal: Proposal };
              setData((current) => ({ ...current, proposals: [...current.proposals, proposal] }));
              toast.success("Предложение отправлено");
            } catch {
              toast.error("Не удалось отправить предложение");
            }
            return;
          }
          const proposal = {
            ...input,
            id: crypto.randomUUID(),
            taskId: task.id,
            teamId,
            status: "pending" as const,
            milestoneConfirmed: false,
          };
          setData((current) => ({
            ...current,
            proposals: [...current.proposals, proposal],
          }));
          toast.success("Предложение отправлено", {
            description: "Переключитесь в роль бизнеса, чтобы увидеть отклик.",
          });
        }}
        onMilestone={async (id) => {
          if (persistedIds.includes(task.id)) {
            const proposal = data.proposals.find((item) => item.id === id);
            try {
              const response = await fetch(`/api/proposals/${id}/milestone`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ evidenceUrl: proposal?.prototypeUrl }),
              });
              if (!response.ok) throw new Error("Этап не подтверждён");
              setData((current) => ({
                ...current,
                proposals: current.proposals.map((item) => item.id === id ? { ...item, milestoneConfirmed: true } : item),
              }));
              toast.success("Этап подтверждён: +10 баллов команде");
            } catch {
              toast.error("Не удалось подтвердить этап");
            }
            return;
          }
          setData((current) => ({
            ...current,
            proposals: current.proposals.map((proposal) =>
              proposal.id === id && proposal.status === "selected"
                ? { ...proposal, milestoneConfirmed: true }
                : proposal,
            ),
          }));
          toast.success("Этап подтверждён: +10 баллов команде", {
            description: "Повторное подтверждение не начисляет баллы снова.",
          });
        }}
      />
    </div>
  );

  return (
    <div
      key={resetGeneration}
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#fbfbfd]"
    >
      <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => setShowDemo(true)}
            aria-label="О Sana"
            className="flex items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Asterisk className="size-8 text-primary" strokeWidth={1.8} />
            <span className="text-[28px] leading-none font-semibold tracking-[-1.4px]">
              sana
            </span>
          </button>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden items-center gap-3 text-[11px] text-muted-foreground xl:flex">
            <ChevronRight className="size-3" />
            Рабочее пространство
          </span>
        </div>
        <div
          className="flex items-center rounded-full bg-[#f0eff4] p-1"
          aria-label="Роль в демо"
        >
          {(
            [
              ["business", "Бизнес", BriefcaseBusiness],
              ["student", "Студент", GraduationCap],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              type="button"
              key={value}
              aria-pressed={role === value}
              onClick={() => changeRole(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] transition-all sm:px-5",
                role === value
                  ? "bg-white font-medium text-primary shadow-[0_1px_4px_#31255012] ring-1 ring-black/[.025]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="hidden size-3.5 sm:block" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDemo(true)}
            className="h-7 gap-1.5 bg-transparent px-2 text-[10px]"
          >
            <span className="size-1.5 rounded-full bg-amber-400" />
            Демо
            <CircleHelp className="size-3 text-muted-foreground" />
          </Button>
          <div
            title={role === "business" ? "Представитель бизнеса" : team.name}
            className="hidden size-8 items-center justify-center rounded-full bg-[#e9e4f8] text-[10px] font-medium text-primary sm:flex"
          >
            {role === "business" ? "Б" : team.initials}
          </div>
        </div>
      </header>
      {compact && (
        <div className="flex shrink-0 gap-1 px-3 pb-2">
          {(
            [
              ["tasks", "Задачи", List],
              ["chat", "Ассистент", MessageSquare],
              [
                "details",
                role === "business" ? "Отклики" : "Предложение",
                Users,
              ],
            ] as const
          ).map(([value, label, Icon]) => (
            <Button
              key={value}
              variant={mobilePane === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMobilePane(value)}
              className="flex-1 text-[11px]"
            >
              <Icon className="size-3.5" />
              {label}
            </Button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 px-3 pb-3">
        {compact ? (
          <div className="h-full">
            {mobilePane === "tasks"
              ? navigation
              : mobilePane === "chat"
                ? center
                : inspector}
          </div>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="gap-0">
            <ResizablePanel
              id="task-navigation"
              defaultSize="19%"
              minSize="215px"
              maxSize="28%"
            >
              {navigation}
            </ResizablePanel>
            <ResizableHandle className="w-2.5 bg-transparent after:w-2.5 hover:after:bg-primary/5" />
            <ResizablePanel
              id="task-conversation"
              defaultSize="51%"
              minSize="380px"
            >
              {center}
            </ResizablePanel>
            <ResizableHandle className="w-2.5 bg-transparent after:w-2.5 hover:after:bg-primary/5" />
            <ResizablePanel
              id="task-inspector"
              defaultSize="30%"
              minSize="310px"
              maxSize="42%"
            >
              {inspector}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      <NewTaskDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={async (description) => {
          try {
          const response = await fetch("/api/tasks", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ description }),
          });
          if (!response.ok) throw new Error("Не удалось создать задачу");
          const { task: next, question } = await response.json() as {
            task: Task;
            question: { field: TaskField; question: string } | null;
          };
          setPersistedIds((current) => [...current, next.id]);
          if (question) setServerQuestions((current) => ({ ...current, [next.id]: question }));
          setData((current) => ({
            ...current,
            tasks: [next, ...current.tasks],
          }));
          setStatus("draft");
          setQuery("");
          selectTask(next.id);
          toast.success("Черновик создан", {
            description: "Ответьте на вопросы или сразу откройте карточку.",
          });
          } catch {
            toast.error("Не удалось создать черновик. Проверьте соединение с базой данных.");
            throw new Error("Не удалось создать черновик");
          }
        }}
      />
      <Dialog open={showDemo} onOpenChange={setShowDemo}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Рабочее пространство в демо-режиме
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Это интерактивный frontend с вымышленными задачами и командами.
              Ассистент отвечает по подготовленным сценариям.
            </DialogDescription>
          </DialogHeader>
          <ol className="my-2 space-y-3 text-xs leading-relaxed">
            {[
              "Создайте задачу, ответьте на вопросы и подтвердите карточку.",
              "Переключитесь в роль студента и предложите решение.",
              "Вернитесь в роль бизнеса и выберите команду.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Примеры задач и откликов доступны для знакомства с интерфейсом.
            Новые задачи и ответы сохраняются в рабочей базе данных.
          </p>
          <Button variant="outline" onClick={resetDemo} className="mt-2">
            <RotateCcw className="size-3.5" />
            Начать демо заново
          </Button>
        </DialogContent>
      </Dialog>
      <Toaster theme="light" position="bottom-center" closeButton />
    </div>
  );
}
