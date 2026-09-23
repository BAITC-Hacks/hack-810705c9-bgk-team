"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  calculateScore,
  createTask,
  getDemoData,
  TASK_FIELDS,
  type Message,
  type Role,
  type Task,
  type TaskField,
  type WorkspaceData,
} from "@/entities/workspace";
import { TaskEditor } from "@/features/task-editor";
import { TaskInspector } from "@/features/task-inspector";
import { StudentCatalog } from "@/features/student-catalog";
import { TeamPicker } from "@/features/team-picker";
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
import { ChatPanel } from "./chat-panel";
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
  const [conversations, setConversations] = useState<Record<string, Message[]>>(
    {},
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, Task>>({});
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
  const canonicalTask =
    data.tasks.find((item) => item.id === selectedId) ?? data.tasks[0];
  const hasDraftEdits = role === "business" && !!taskDrafts[canonicalTask.id];
  const task =
    role === "business"
      ? (taskDrafts[canonicalTask.id] ?? canonicalTask)
      : canonicalTask;
  const team = data.teams.find((item) => item.id === teamId) ?? data.teams[0];
  const conversationKey = task.id;
  const messages = conversations[conversationKey] ?? [];
  const points =
    data.proposals.filter(
      (proposal) => proposal.teamId === teamId && proposal.milestoneConfirmed,
    ).length * 10;

  function changeRole(next: Role) {
    setRole(next);
    setTab("assistant");
    setQuery("");
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

  function saveTask(next: Task) {
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

  function sendMessage(text: string, field?: TaskField) {
    let response = "";
    if (field) {
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
    } else {
      response =
        "Уточнение осталось в этой беседе. В демо-режиме выберите один из вопросов выше, чтобы записать ответ в нужное поле, или откройте «Карточку задачи».\n\nЯ не добавляю неподтверждённые факты и не публикую задачу за вас.";
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
    setData(next);
    setConversations({});
    setTaskDrafts({});
    setResetGeneration((current) => current + 1);
    setShowCreate(false);
    setRole("business");
    setSelectedId(next.tasks[0].id);
    setTeamId(next.teams[0].id);
    setQuery("");
    setStatus("published");
    setTab("assistant");
    setShowDemo(false);
    setMobilePane("chat");
    toast.success("Демонстрация начата заново");
  }

  const navigation = (
    <TaskNavigation
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
    />
  );
  const center = (
    <main
      className="workspace-panel flex flex-col bg-card"
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
          <span className="mt-1 shrink-0 text-[11px] text-muted-foreground">
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
          {tab === "assistant" && (
            <button
              type="button"
              onClick={() => setTab("card")}
              className="ml-auto mb-2 hidden items-center gap-1 text-[10px] text-primary xl:flex"
            >
              {task.status === "draft" ? "К публикации" : "Улучшить"}
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
            key={task.id}
            task={task}
            messages={messages}
            onSend={sendMessage}
            onEdit={() => setTab("card")}
          />
        ) : (
          <TaskEditor
            key={task.id}
            task={task}
            savedTask={canonicalTask}
            onSave={saveTask}
            onCancel={() => setTab("assistant")}
          />
        )}
      </div>
    </main>
  );
  const inspector = (
    <TaskInspector
      role={role}
      task={task}
      teams={data.teams}
      proposals={data.proposals}
      activeTeamId={teamId}
      onEditTask={() => {
        setTab("card");
        setMobilePane("chat");
      }}
      onDecision={(id, decision) => {
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
      onApply={(input) => {
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
      onMilestone={(id) => {
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
  );

  return (
    <div
      key={resetGeneration}
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background"
    >
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => setShowDemo(true)}
            aria-label="О AI-Sana"
            className="flex items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="text-xl leading-none font-semibold tracking-tight">
              AI-Sana
            </span>
          </button>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden items-center gap-3 text-[11px] text-muted-foreground xl:flex">
            Рабочее пространство
          </span>
        </div>
        <div
          className="flex items-center rounded-full bg-muted p-1"
          aria-label="Роль в демо"
        >
          {(
            [
              ["business", "Бизнес"],
              ["student", "Студент"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={role === value}
              onClick={() => changeRole(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] transition-all sm:px-5",
                role === value
                  ? "bg-card font-medium text-primary shadow-sm ring-1 ring-primary/5"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDemo(true)}
            className="h-7 gap-1.5 bg-transparent px-2 text-[10px]"
          >
            Демо
          </Button>
          <div
            title={role === "business" ? "Представитель бизнеса" : team.name}
            className="hidden size-8 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-primary sm:flex"
          >
            {role === "business" ? "Б" : team.initials}
          </div>
        </div>
      </header>
      {role === "business" && compact && (
        <div className="flex shrink-0 gap-1 px-3 pb-2">
          {(
            [
              ["tasks", "Задачи"],
              ["chat", "Ассистент"],
              ["details", "Отклики"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={mobilePane === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMobilePane(value)}
              className="flex-1 text-[11px]"
            >
              {label}
            </Button>
          ))}
        </div>
      )}
      <div className={cn("min-h-0 flex-1", role === "business" && "p-3")}>
        {role === "student" ? (
          <StudentCatalog
            tasks={data.tasks}
            proposals={data.proposals}
            activeTeamId={teamId}
            selectedTaskId={canonicalTask.id}
            onSelectTask={selectTask}
            teamControl={
              <TeamPicker
                teams={data.teams}
                activeTeamId={teamId}
                onTeamChange={setTeamId}
                points={points}
                onTeamSave={(next) => {
                  setData((current) => ({
                    ...current,
                    teams: current.teams.some((item) => item.id === next.id)
                      ? current.teams.map((item) =>
                          item.id === next.id ? next : item,
                        )
                      : [...current.teams, next],
                  }));
                  setTeamId(next.id);
                  toast.success("Профиль команды сохранён");
                }}
              />
            }
          >
            {inspector}
          </StudentCatalog>
        ) : compact ? (
          <div className="h-full">
            {mobilePane === "tasks" ? (
              navigation
            ) : mobilePane === "chat" ? (
              center
            ) : (
              <div className="workspace-panel bg-workspace-surface">
                {inspector}
              </div>
            )}
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
              <div className="workspace-panel bg-workspace-surface">
                {inspector}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      <NewTaskDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={(description) => {
          const next = createTask(description);
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
        }}
      />
      <Dialog open={showDemo} onOpenChange={setShowDemo}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              AI-Sana · демо
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
            Данные хранятся в памяти вкладки и сбрасываются при обновлении
            страницы. Отправки во внешние сервисы нет.
          </p>
          <Button variant="outline" onClick={resetDemo} className="mt-2">
            Начать демо заново
          </Button>
        </DialogContent>
      </Dialog>
      <Toaster theme="light" position="bottom-center" closeButton />
    </div>
  );
}
