"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowsExpand,
  FileText,
  Keyboard,
  LayoutSideContentLeft,
  LayoutSideContentRight,
  Xmark,
} from "@gravity-ui/icons";
import type {
  GroupImperativeHandle,
  Layout,
  PanelImperativeHandle,
} from "react-resizable-panels";
import { toast } from "sonner";
import {
  buildAssistantContext,
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
import { TaskEditor, type TaskEditorDraft } from "@/features/task-editor";
import { TaskInspector } from "@/features/task-inspector";
import { StudentCatalog } from "@/features/student-catalog";
import { TeamPicker } from "@/features/team-picker";
import { Button } from "@/shared/components/ui/button";
import { IconAction } from "@/shared/components/icon-action";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import {
  isTextEditing,
  shouldHandleShortcut,
} from "@/shared/lib/keyboard-shortcuts";
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
import { askTaskManager } from "../api/assistant-client";
import { ChatPanel } from "./chat-panel";
import { CHAT_SKILLS, type ChatSkillId } from "./chat-skills";
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
const DEFAULT_LAYOUT: Layout = {
  "task-navigation": 16,
  "task-conversation": 60,
  "task-inspector": 24,
};
const FOCUS_LAYOUT: Layout = {
  "task-navigation": 0,
  "task-conversation": 100,
  "task-inspector": 0,
};

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspaceData>(getDemoData);
  const [role, setRole] = useState<Role>("business");
  const [selectedId, setSelectedId] = useState("bakery-waste");
  const [teamId, setTeamId] = useState(() => getDemoData().teams[0].id);
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [cardOpen, setCardOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<Record<string, Message[]>>(
    {},
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, Task>>({});
  const [resetGeneration, setResetGeneration] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [assistantPending, setAssistantPending] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const panelsRef = useRef<GroupImperativeHandle>(null);
  const navigationRef = useRef<PanelImperativeHandle>(null);
  const inspectorRef = useRef<PanelImperativeHandle>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const mobileContentRef = useRef<HTMLDivElement>(null);
  const editorReturnFocus = useRef<HTMLElement | null>(null);
  const editorDrafts = useRef(new Map<string, TaskEditorDraft>());
  const previousLayout = useRef<Layout | undefined>(undefined);
  const [mobileDrawer, setMobileDrawer] = useState<"tasks" | "details" | null>(
    null,
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
    if (next === role) return;
    setFocusMode(false);
    setRole(next);
    setCardOpen(false);
    setMobileDrawer(null);
    setQuery("");
    setStatus("published");
    if (task.status !== "published")
      setSelectedId(
        data.tasks.find((item) => item.status === "published")?.id ?? task.id,
      );
  }

  function toggleFocus() {
    const panels = panelsRef.current;
    if (!panels) return;
    if (focusMode) {
      panels.setLayout(previousLayout.current ?? DEFAULT_LAYOUT);
    } else {
      previousLayout.current = panels.getLayout();
      panels.setLayout(FOCUS_LAYOUT);
    }
    setFocusMode(!focusMode);
  }

  function toggleNavigation() {
    if (compact) {
      setMobileDrawer((current) => (current === "tasks" ? null : "tasks"));
      return;
    }
    setFocusMode(false);
    if (navigationRef.current?.isCollapsed()) navigationRef.current.expand();
    else navigationRef.current?.collapse();
  }

  function toggleProposals() {
    if (compact) {
      setMobileDrawer((current) => (current === "details" ? null : "details"));
      return;
    }
    setFocusMode(false);
    if (inspectorRef.current?.isCollapsed()) inspectorRef.current.expand();
    else inspectorRef.current?.collapse();
  }

  function showProposals() {
    if (compact) setMobileDrawer("details");
    else {
      setFocusMode(false);
      inspectorRef.current?.expand();
    }
  }

  function openCard() {
    editorReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMobileDrawer(null);
    setCardOpen(true);
  }

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const scope = cardOpen
      ? editorContentRef.current
      : mobileDrawer
        ? mobileContentRef.current
        : null;
    if (!shouldHandleShortcut(event, scope)) return;
    if (role === "business" && event.altKey && !event.shiftKey) {
      if (cardOpen && event.code !== "Digit2") return;
      if (
        mobileDrawer &&
        event.code !== (mobileDrawer === "tasks" ? "Digit1" : "Digit3")
      )
        return;
      const actions: Record<string, () => void> = {
        Digit1: toggleNavigation,
        Digit2: () => (cardOpen ? setCardOpen(false) : openCard()),
        Digit3: toggleProposals,
        ...(!compact ? { Digit0: toggleFocus } : {}),
      };
      if (actions[event.code]) {
        event.preventDefault();
        actions[event.code]();
      }
      return;
    }
    if (cardOpen || mobileDrawer) return;
    if (
      role === "business" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.code === "KeyK"
    ) {
      event.preventDefault();
      document.getElementById("chat-message")?.focus();
    } else if (
      event.key === "?" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isTextEditing(event.target)
    ) {
      event.preventDefault();
      setShortcutsOpen(true);
    } else if (event.key === "Escape" && focusMode) {
      event.preventDefault();
      toggleFocus();
    }
  });
  useEffect(() => {
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  function selectTask(id: string) {
    setSelectedId(id);
    setCardOpen(false);
    setMobileDrawer(null);
  }

  function saveTask(next: Task) {
    editorDrafts.current.delete(next.id);
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

  function sendMessage(text: string, field?: TaskField, skill?: ChatSkillId) {
    // Запись ответа в поле карточки — локальная мутация; реплику ассистента
    // всё равно генерирует Mastra (хардкода ответов в чате больше нет).
    let message = text;
    if (field) {
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
      const label = TASK_FIELDS.find((item) => item.key === field)?.label;
      message = `Ответ в поле «${label}» записан в карточку (не подтверждён): ${text}`;
    }

    appendMessages(conversationKey, [
      {
        id: crypto.randomUUID(),
        role: "user",
        content: skill
          ? `@${CHAT_SKILLS.find((item) => item.id === skill)?.label}${text ? `\n${text}` : ""}`
          : text,
      },
    ]);

    sessionIdRef.current ??= crypto.randomUUID();
    const key = conversationKey;
    setAssistantPending(key);
    void askTaskManager({
      threadId: `${sessionIdRef.current}:${task.id}`,
      skill,
      message,
      context: buildAssistantContext(task, data.proposals, data.teams),
    })
      .then((reply) => {
        appendMessages(key, [
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              reply?.reply ??
              "Ассистент сейчас недоступен — Mastra не ответила. Попробуйте отправить сообщение ещё раз через минуту.",
          },
        ]);
      })
      .finally(() => {
        setAssistantPending((current) => (current === key ? null : current));
      });
  }

  function appendMessages(key: string, additions: Message[]) {
    setConversations((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), ...additions],
    }));
  }

  function resetDemo() {
    const next = getDemoData();
    setData(next);
    setConversations({});
    setTaskDrafts({});
    editorDrafts.current.clear();
    setResetGeneration((current) => current + 1);
    setShowCreate(false);
    setRole("business");
    setSelectedId(next.tasks[0].id);
    setTeamId(next.teams[0].id);
    setQuery("");
    setStatus("published");
    setCardOpen(false);
    setShortcutsOpen(false);
    setShowDemo(false);
    setFocusMode(false);
    setMobileDrawer(null);
    toast.success("Демонстрация начата заново");
  }

  const navigation = (
    <TaskNavigation
      tasks={data.tasks}
      selectedId={task.id}
      onSelect={selectTask}
      onCreate={() => setShowCreate(true)}
      onClose={toggleNavigation}
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
      aria-label="Чат по задаче"
    >
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 lg:px-5">
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-lg font-bold tracking-tight"
            title={task.title}
          >
            {task.title}
          </h1>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">Чат по задаче · {task.company}</span>
            <span className="hidden shrink-0 sm:inline">
              ·{" "}
              {hasDraftEdits
                ? "Есть изменения"
                : task.status === "published"
                  ? "Опубликована"
                  : "Черновик"}
            </span>
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5"
          role="group"
          aria-label="Панели задачи"
        >
          <IconAction
            label="Список задач"
            shortcut="Alt + 1"
            aria-keyshortcuts="Alt+1"
            aria-pressed={!compact && !navigationCollapsed}
            onClick={toggleNavigation}
          >
            <LayoutSideContentLeft className="size-4" />
          </IconAction>
          <IconAction
            label="Карточка задачи"
            shortcut="Alt + 2"
            aria-keyshortcuts="Alt+2"
            aria-expanded={cardOpen}
            onClick={openCard}
          >
            <FileText className="size-4" />
          </IconAction>
          <IconAction
            label="Отклики команд"
            shortcut="Alt + 3"
            aria-keyshortcuts="Alt+3"
            aria-pressed={!compact && !inspectorCollapsed}
            onClick={toggleProposals}
          >
            <LayoutSideContentRight className="size-4" />
          </IconAction>
          {!compact && (
            <IconAction
              label={focusMode ? "Вернуть панели" : "Развернуть чат"}
              shortcut="Alt + 0"
              aria-keyshortcuts="Alt+0"
              aria-pressed={focusMode}
              onClick={toggleFocus}
            >
              <ArrowsExpand className="size-4" />
            </IconAction>
          )}
        </div>
      </header>
      <ChatPanel
        key={task.id}
        task={task}
        messages={messages}
        pending={assistantPending === conversationKey}
        onSend={sendMessage}
        onEdit={openCard}
        onShowProposals={showProposals}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
    </main>
  );
  const inspector = (
    <TaskInspector
      role={role}
      task={task}
      teams={data.teams}
      proposals={data.proposals}
      activeTeamId={teamId}
      onEditTask={openCard}
      onClose={toggleProposals}
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
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => setShowDemo(true)}
            aria-label="О AI-Sana"
            className="flex items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="text-[23px] leading-none font-bold tracking-[-.7px]">
              AI-Sana
            </span>
          </button>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden items-center gap-3 text-[13px] font-medium text-muted-foreground xl:flex">
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
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors sm:px-5",
                role === value
                  ? "bg-card text-primary shadow-sm ring-1 ring-primary/5"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <IconAction
            label="Горячие клавиши"
            shortcut="?"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard className="size-4" />
          </IconAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDemo(true)}
            className="h-8 gap-1.5 bg-transparent px-2 text-xs font-semibold"
          >
            Демо
          </Button>
          <div
            title={role === "business" ? "Представитель бизнеса" : team.name}
            className="hidden size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary sm:flex"
          >
            {role === "business" ? "Б" : team.initials}
          </div>
        </div>
      </header>
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
          center
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            className="gap-0"
            groupRef={panelsRef}
            defaultLayout={focusMode ? FOCUS_LAYOUT : DEFAULT_LAYOUT}
            disabled={focusMode}
          >
            <ResizablePanel
              id="task-navigation"
              panelRef={navigationRef}
              defaultSize="16%"
              minSize="208px"
              maxSize="26%"
              collapsible
              collapsedSize={0}
              onResize={(size) =>
                setNavigationCollapsed(size.asPercentage === 0)
              }
              inert={focusMode || navigationCollapsed}
              aria-hidden={focusMode || navigationCollapsed || undefined}
            >
              {navigation}
            </ResizablePanel>
            <ResizableHandle
              aria-label="Ширина списка задач"
              className={cn(
                "w-2.5 bg-transparent after:w-2.5 hover:after:bg-primary/5",
                focusMode && "hidden",
              )}
            />
            <ResizablePanel
              id="task-conversation"
              defaultSize="60%"
              minSize="480px"
            >
              {center}
            </ResizablePanel>
            <ResizableHandle
              aria-label="Ширина панели откликов"
              className={cn(
                "w-2.5 bg-transparent after:w-2.5 hover:after:bg-primary/5",
                focusMode && "hidden",
              )}
            />
            <ResizablePanel
              id="task-inspector"
              panelRef={inspectorRef}
              defaultSize="24%"
              minSize="310px"
              maxSize="42%"
              collapsible
              collapsedSize={0}
              onResize={(size) =>
                setInspectorCollapsed(size.asPercentage === 0)
              }
              inert={focusMode || inspectorCollapsed}
              aria-hidden={focusMode || inspectorCollapsed || undefined}
            >
              <div className="workspace-panel bg-workspace-surface">
                {inspector}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      <Sheet open={cardOpen && role === "business"} onOpenChange={setCardOpen}>
        <SheetContent
          ref={editorContentRef}
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[600px]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const previous = editorReturnFocus.current;
            if (previous?.isConnected && !previous.closest("[inert]"))
              previous.focus();
            else document.getElementById("chat-message")?.focus();
          }}
        >
          <SheetTitle className="sr-only">Карточка задачи</SheetTitle>
          <SheetDescription className="sr-only">
            Редактирование и подтверждение сведений перед публикацией.
          </SheetDescription>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
            <span className="truncate text-sm font-semibold" title={task.title}>
              {task.title}
            </span>
            <IconAction
              label="Закрыть карточку"
              shortcut="Esc · Alt + 2"
              onClick={() => setCardOpen(false)}
            >
              <Xmark className="size-4" />
            </IconAction>
          </div>
          <div className="min-h-0 flex-1">
            <TaskEditor
              key={task.id}
              task={task}
              savedTask={canonicalTask}
              draftCache={editorDrafts.current}
              onSave={saveTask}
              onCancel={() => setCardOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet
        open={compact && mobileDrawer !== null && role === "business"}
        onOpenChange={(open) => {
          if (!open) setMobileDrawer(null);
        }}
      >
        <SheetContent
          ref={mobileContentRef}
          side={mobileDrawer === "tasks" ? "left" : "right"}
          showCloseButton={false}
          className="gap-0 p-0 data-[side=left]:w-full data-[side=right]:w-full data-[side=left]:sm:max-w-[380px] data-[side=right]:sm:max-w-[420px] [&_.workspace-panel]:rounded-none [&_.workspace-panel]:border-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("chat-message")?.focus();
          }}
        >
          <SheetTitle className="sr-only">
            {mobileDrawer === "tasks" ? "Мои задачи" : "Отклики команд"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Панель текущей задачи. Escape закрывает панель и возвращает в чат.
          </SheetDescription>
          {mobileDrawer === "tasks" ? navigation : inspector}
        </SheetContent>
      </Sheet>
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Горячие клавиши
            </DialogTitle>
            <DialogDescription>
              Быстрые действия в режиме{" "}
              {role === "business" ? "бизнеса" : "студента"}.
            </DialogDescription>
          </DialogHeader>
          <dl className="mt-2 divide-y text-sm">
            {[
              [
                "Ctrl / ⌘ + K",
                role === "business"
                  ? "Перейти к сообщению"
                  : "Поиск по каталогу",
              ],
              ...(role === "business"
                ? [["Alt + 1", "Показать / скрыть задачи"]]
                : []),
              ["Alt + 2", "Открыть / закрыть карточку"],
              [
                "Alt + 3",
                role === "business"
                  ? "Показать / скрыть отклики"
                  : "Открыть / закрыть команды",
              ],
              ...(role === "business" && !compact
                ? [["Alt + 0", "Развернуть / свернуть чат"]]
                : []),
              ...(role === "business"
                ? [
                    ["@", "Действия ассистента в сообщении"],
                    ["↑ ↓ · Enter / Tab", "Выбрать действие из @-меню"],
                    ["Shift + Enter", "Новая строка в сообщении"],
                  ]
                : []),
              ["Esc", "Закрыть меню или верхнюю панель"],
              ["?", "Эта подсказка вне поля ввода"],
            ].map(([keys, description]) => (
              <div
                key={keys}
                className="flex items-center justify-between gap-4 py-3"
              >
                <dt>{description}</dt>
                <dd className="shrink-0 rounded border bg-muted px-2 py-1 text-xs font-medium">
                  {keys}
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
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
              Ассистент отвечает через Mastra по данным карточки; если ИИ
              недоступен — по локальным сценариям.
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
            Данные карточек хранятся в памяти вкладки и сбрасываются при
            обновлении страницы. Сообщения ассистента отправляются в Mastra
            (apps/ai-logic-layer).
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
