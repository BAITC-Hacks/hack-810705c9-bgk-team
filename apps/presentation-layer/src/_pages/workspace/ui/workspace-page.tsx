"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowsExpand,
  ArrowDownToLine,
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  calculateScore,
  getTaskSummary,
  getWorkspaceTasks,
  workspaceIdentity,
  readiness,
  TASK_FIELDS,
  type Message,
  type Role,
  type Task,
  type TaskField,
  type WorkspaceData,
} from "@/entities/workspace";
import { requestError, workspaceApi, type WorkspaceSession, type WorkspaceSnapshot } from "@/entities/workspace/api";
import { TaskEditor, hasTaskEditorChanges, type TaskEditorDraft } from "@/features/task-editor";
import { TaskDocumentsPanel, TaskDocumentsProvider, useTaskDocuments } from "@/features/task-documents";
import { TaskInspector } from "@/features/task-inspector";
import { StudentCatalog } from "@/features/student-catalog";
import { TeamPicker } from "@/features/team-picker";
import { OnboardingScreen } from "@/features/onboarding";
import { Button } from "@/shared/components/ui/button";
import { IconAction } from "@/shared/components/icon-action";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { AiSanaLogo } from "@/shared/components/ai-sana-logo";
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
import { ChatPanel } from "./chat-panel";
import { CHAT_SKILLS, runChatSkill, type ChatSkillId } from "./chat-skills";
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
  return <WorkspaceLoader />;
}

function WorkspaceLoader() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function load() {
    const next = await workspaceApi.load();
    setSnapshot(next);
    setError("");
  }

  async function retry() {
    setLoading(true);
    try { await load(); } catch (failure) { setError(requestError(failure)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    workspaceApi.load().then((next) => {
      if (active) setSnapshot(next);
    }).catch((failure) => {
      if (active) setError(requestError(failure));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function changeSession(next: Partial<WorkspaceSession>) {
    // Hide controls while cookies and workspace data move to the new identity.
    setLoading(true);
    try {
      await workspaceApi.session(next);
      router.refresh();
      await load();
    } catch (failure) {
      setSnapshot(null);
      setError(requestError(failure));
      throw failure;
    } finally { setLoading(false); }
  }

  const setData: Dispatch<SetStateAction<WorkspaceData>> = (update) => {
    setSnapshot((current) => current && snapshot && workspaceIdentity(current.session) === workspaceIdentity(snapshot.session) ? {
      ...current,
      ...(typeof update === "function" ? update(current) : update),
    } : current);
  };

  if (loading || !snapshot) return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="absolute top-3 right-4"><ThemeToggle /></div>
      <div className="max-w-md space-y-4 text-center" role={error ? "alert" : "status"}>
        <h1 className="text-xl font-semibold">{loading ? "Загружаем рабочее пространство…" : "Не удалось загрузить данные"}</h1>
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
        {!loading && <Button onClick={() => void retry()}>Попробовать снова</Button>}
      </div>
    </main>
  );

  if (!snapshot.session.onboardingCompleted) return <OnboardingScreen snapshot={snapshot} onComplete={async () => {
    await load();
    router.refresh();
  }} />;

  const workspaceTasks = getWorkspaceTasks(snapshot.tasks, snapshot.session.role);
  if (!workspaceTasks.length) return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="absolute top-3 right-4"><ThemeToggle /></div>
      <div className="max-w-lg space-y-5 text-center">
        <h1 className="text-2xl font-semibold">{snapshot.session.role === "business" ? "Создайте первую задачу" : "Пока нет опубликованных задач"}</h1>
        <p className="text-sm text-muted-foreground">{snapshot.session.role === "business" ? "Опишите задачу, заполните карточку и опубликуйте её для студенческих команд." : "Бизнес ещё готовит задачи. Обновите каталог позже."}</p>
        <div className="flex justify-center gap-3">
          {snapshot.session.role === "business" && <Button onClick={() => setShowCreate(true)}>Новая задача</Button>}
          <Button variant="outline" disabled={switching} onClick={async () => {
            setSwitching(true);
            try { await changeSession({ role: snapshot.session.role === "business" ? "student" : "business" }); }
            catch (failure) { toast.error(requestError(failure)); }
            finally { setSwitching(false); }
          }}>{snapshot.session.role === "business" ? "Роль студента" : "Роль бизнеса"}</Button>
          <Button variant="outline" onClick={() => void retry()}>Обновить</Button>
        </div>
      </div>
      <NewTaskDialog open={showCreate} onOpenChange={setShowCreate} onCreate={async (description) => {
        const task = await workspaceApi.createTask(description);
        setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
      }} />
      <Toaster position="bottom-center" closeButton />
    </main>
  );

  return <TaskDocumentsProvider key={workspaceIdentity(snapshot.session)}>
    <WorkspaceContent data={{ ...snapshot, tasks: workspaceTasks }} setData={setData}
      session={snapshot.session} onSessionChange={changeSession} onReload={load} />
  </TaskDocumentsProvider>;
}

function WorkspaceContent({ data, setData, session, onSessionChange, onReload }: {
  data: WorkspaceSnapshot;
  setData: Dispatch<SetStateAction<WorkspaceData>>;
  session: WorkspaceSession;
  onSessionChange: (next: Partial<WorkspaceSession>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const role = session.role;
  const teamId = session.teamId ?? "";
  const [switching, setSwitching] = useState(false);
  const [selectedId, setSelectedId] = useState(data.tasks[0].id);
  const [status, setStatus] = useState<"published" | "draft">(data.tasks[0].status);
  const [cardOpen, setCardOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<Record<string, Message[]>>(
    {},
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, Task>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const panelsRef = useRef<GroupImperativeHandle>(null);
  const navigationRef = useRef<PanelImperativeHandle>(null);
  const inspectorRef = useRef<PanelImperativeHandle>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const documentsContentRef = useRef<HTMLDivElement>(null);
  const mobileContentRef = useRef<HTMLDivElement>(null);
  const editorReturnFocus = useRef<HTMLElement | null>(null);
  const documentsReturnFocus = useRef<HTMLElement | null>(null);
  const [editorDrafts] = useState(() => new Map<string, TaskEditorDraft>());
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
  const hasDraftEdits = role === "business" && (
    !!taskDrafts[canonicalTask.id] ||
    hasTaskEditorChanges(editorDrafts.get(canonicalTask.id), canonicalTask)
  );
  const task =
    role === "business"
      ? (taskDrafts[canonicalTask.id] ?? canonicalTask)
      : canonicalTask;
  const team = data.teams.find((item) => item.id === teamId) ?? data.teams[0];
  const taskDocuments = useTaskDocuments(task.id);
  const conversationKey = task.id;
  const messages = conversations[conversationKey] ?? [];
  const points = data.proposals
    .filter((proposal) => proposal.teamId === teamId)
    .reduce((sum, proposal) => sum + (proposal.points ?? (proposal.milestoneConfirmed ? 10 : 0)), 0);

  async function changeRole(next: Role) {
    if (next === role || switching) return;
    setSwitching(true);
    try {
      await onSessionChange({ role: next });
      setFocusMode(false);
      setCardOpen(false);
      setDocumentsOpen(false);
      setMobileDrawer(null);
      setQuery("");
      setStatus("published");
    } catch (failure) { toast.error(requestError(failure)); }
    finally { setSwitching(false); }
  }

  async function changeTeam(id: string) {
    await onSessionChange({ teamId: id });
  }

  function toggleFocus() {
    const panels = panelsRef.current;
    if (!panels) return;
    if (focusMode) {
      panels.setLayout(previousLayout.current ?? DEFAULT_LAYOUT);
    } else {
      focusChatIfInside("task-navigation", "task-inspector");
      previousLayout.current = panels.getLayout();
      panels.setLayout(FOCUS_LAYOUT);
    }
    setFocusMode(!focusMode);
  }

  function focusChatIfInside(...panelIds: string[]) {
    if (
      panelIds.some((id) =>
        document.getElementById(id)?.contains(document.activeElement),
      )
    ) {
      document.getElementById("chat-message")?.focus();
    }
  }

  function toggleNavigation() {
    if (compact) {
      setMobileDrawer((current) => (current === "tasks" ? null : "tasks"));
      return;
    }
    setFocusMode(false);
    if (navigationRef.current?.isCollapsed()) navigationRef.current.expand();
    else {
      focusChatIfInside("task-navigation");
      navigationRef.current?.collapse();
    }
  }

  function toggleProposals() {
    if (compact) {
      setMobileDrawer((current) => (current === "details" ? null : "details"));
      return;
    }
    setFocusMode(false);
    if (inspectorRef.current?.isCollapsed()) inspectorRef.current.expand();
    else {
      focusChatIfInside("task-inspector");
      inspectorRef.current?.collapse();
    }
  }

  function showProposals() {
    if (compact) setMobileDrawer("details");
    else {
      setFocusMode(false);
      inspectorRef.current?.expand();
    }
  }

  function openCard() {
    if (task.canEdit === false) {
      toast.error("Изменять карточку может только её бизнес-владелец. Выберите свою задачу.");
      return;
    }
    editorReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMobileDrawer(null);
    setDocumentsOpen(false);
    setCardOpen(true);
  }

  function openDocuments() {
    documentsReturnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMobileDrawer(null);
    setCardOpen(false);
    setDocumentsOpen(true);
  }

  function downloadTaskBrief() {
    const score = calculateScore(canonicalTask);
    const content = [
      "AI-Sana · Карточка задачи",
      `Статус: ${canonicalTask.status === "published" ? "Опубликована" : "Черновик"}`,
      `Готовность: ${score}/100 · ${readiness(score).label}`,
      "",
      getTaskSummary(canonicalTask),
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${canonicalTask.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 80) || "Задача"}.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const scope = documentsOpen
      ? documentsContentRef.current
      : cardOpen
        ? editorContentRef.current
      : compact && mobileDrawer
        ? mobileContentRef.current
        : null;
    if (!shouldHandleShortcut(event, scope)) return;
    if (event.key === "Escape" && scope) {
      event.preventDefault();
      if (documentsOpen) setDocumentsOpen(false);
      else if (cardOpen) setCardOpen(false);
      else setMobileDrawer(null);
      return;
    }
    if (role === "business" && event.altKey && !event.shiftKey) {
      if (documentsOpen && event.code !== "Digit4") return;
      if (cardOpen && event.code !== "Digit2") return;
      if (
        compact &&
        mobileDrawer &&
        event.code !== (mobileDrawer === "tasks" ? "Digit1" : "Digit3")
      )
        return;
      const actions: Record<string, () => void> = {
        Digit1: toggleNavigation,
        Digit2: () => (cardOpen ? setCardOpen(false) : openCard()),
        Digit3: toggleProposals,
        Digit4: () => (documentsOpen ? setDocumentsOpen(false) : openDocuments()),
        ...(!compact ? { Digit0: toggleFocus } : {}),
      };
      if (actions[event.code]) {
        event.preventDefault();
        actions[event.code]();
      }
      return;
    }
    if (documentsOpen || cardOpen || (compact && mobileDrawer)) return;
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
    document.addEventListener("keydown", handleShortcut, true);
    return () => document.removeEventListener("keydown", handleShortcut, true);
  }, []);

  function selectTask(id: string) {
    setSelectedId(id);
    setCardOpen(false);
    setDocumentsOpen(false);
    setMobileDrawer(null);
  }

  async function saveTask(input: Task) {
    if (task.canEdit === false) {
      toast.error("Изменять карточку может только её бизнес-владелец. Выберите свою задачу.");
      return;
    }
    const next = await workspaceApi.saveTask(input);
    editorDrafts.delete(next.id);
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

  async function sendMessage(text: string, field?: TaskField, skill?: ChatSkillId) {
    let response = "";
    if (skill) {
      response = runChatSkill(task, data.proposals, data.teams, skill, text);
    } else if (field) {
      if (task.canEdit === false) throw new Error("Изменять карточку может только её бизнес-владелец.");
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
        const saved = await workspaceApi.saveTask(update(task));
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((item) =>
            item.id === saved.id ? saved : item,
          ),
        }));
      }
      response = `Добавила ваш ответ в поле «${label}» без изменений.\n\nОткройте карточку, проверьте текст и подтвердите сведения — после этого пересчитается рейтинг.`;
    } else {
      const reply = await workspaceApi.chat(task.id, [
        { role: "user", content: task.description },
        ...messages.map(({ role, content }) => ({ role, content })),
        { role: "user", content: text },
      ]);
      response = reply.text;
    }
    setConversations((current) => ({
      ...current,
      [conversationKey]: [
        ...(current[conversationKey] ?? []),
        {
          id: crypto.randomUUID(),
          role: "user",
          content: skill
            ? `@${CHAT_SKILLS.find((item) => item.id === skill)?.label}${text ? `\n${text}` : ""}`
            : text,
        },
        { id: crypto.randomUUID(), role: "assistant", content: response },
      ],
    }));
  }

  async function refreshWorkspace() {
    if (switching) return;
    setSwitching(true);
    try {
      await onReload();
      setShowCreate(false);
      setQuery("");
      setCardOpen(false);
      setShortcutsOpen(false);
      setShowHelp(false);
      setFocusMode(false);
      setMobileDrawer(null);
      toast.success("Сохранённые данные обновлены");
    } catch (failure) { toast.error(requestError(failure)); }
    finally { setSwitching(false); }
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
            <button
              type="button"
              onClick={openCard}
              className="shrink-0 font-semibold text-foreground underline-offset-4 hover:underline"
              aria-label={`Готовность задачи: ${calculateScore(canonicalTask)} из 100. Открыть карточку`}
              title="Готовность подтверждённой карточки"
            >
              {calculateScore(canonicalTask)} / 100
            </button>
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
        onSend={sendMessage}
        onEdit={openCard}
        onShowProposals={showProposals}
        documents={taskDocuments.documents.map(({ id, file }) => ({ id, name: file.name }))}
        onShowDocuments={openDocuments}
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
      canUndoDecision={false}
      onEditTask={openCard}
      onClose={toggleProposals}
      onDecision={async (id, decision, reason) => {
        const saved = await workspaceApi.decide(id, decision, reason);
        setData((current) => ({
          ...current,
          proposals: current.proposals.map((proposal) =>
            proposal.id === id ? saved : proposal,
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
      onSubmitMilestone={async (id, submission) => {
        const proposal = await workspaceApi.submitMilestone(id, submission);
        setData((current) => ({
          ...current,
          proposals: current.proposals.map((item) =>
            item.id === id ? proposal : item,
          ),
        }));
        toast.success("Результат этапа отправлен", {
          description: "Баллы появятся после подтверждения бизнесом.",
        });
      }}
      onMilestone={async (id) => {
        const proposal = await workspaceApi.confirmMilestone(id);
        setData((current) => ({
          ...current,
          proposals: current.proposals.map((item) =>
            item.id === id ? proposal : item,
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
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background"
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 sm:gap-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/onboarding"
            aria-label="Вернуться к знакомству с платформой"
            data-logo-trigger
            className="flex h-9 shrink-0 items-center rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <AiSanaLogo
              aria-hidden="true"
              className="h-auto w-20 min-[375px]:w-24 sm:w-28"
            />
          </Link>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden items-center gap-3 text-[13px] font-medium text-muted-foreground xl:flex">
            Рабочее пространство
          </span>
        </div>
        <div
          className="flex items-center rounded-full bg-muted p-1"
          aria-label="Режим работы"
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
              disabled={switching}
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
          <ThemeToggle />
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
            onClick={() => setShowHelp(true)}
            className="hidden h-8 gap-1.5 bg-transparent px-2 text-xs font-semibold min-[400px]:inline-flex"
          >
            Помощь
          </Button>
          <div
            title={role === "business" ? data.business?.name ?? "Представитель бизнеса" : team?.name ?? "Студент"}
            className="hidden size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary sm:flex"
          >
            {role === "business" && data.business?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.business.logoUrl} alt="Логотип компании" className="size-8 rounded-full object-contain" />
            ) : role === "business" ? data.business?.name.charAt(0).toLocaleUpperCase("ru") ?? "Б" : team?.initials ?? "С"}
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
                onTeamChange={changeTeam}
                points={points}
                onTeamSave={async (input) => {
                  const next = await workspaceApi.saveTeam(input, data.teams.some((item) => item.id === input.id));
                  setData((current) => ({
                    ...current,
                    teams: current.teams.some((item) => item.id === next.id)
                      ? current.teams.map((item) =>
                          item.id === next.id ? next : item,
                        )
                      : [...current.teams, next],
                  }));
                  toast.success("Профиль команды сохранён");
                  try { await changeTeam(next.id); }
                  catch (failure) { toast.error(`Профиль сохранён, но переключить команду не удалось. ${requestError(failure)}`); }
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
              onResize={(size) => {
                if (size.asPercentage === 0)
                  focusChatIfInside("task-navigation");
                setNavigationCollapsed(size.asPercentage === 0);
              }}
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
              onResize={(size) => {
                if (size.asPercentage === 0)
                  focusChatIfInside("task-inspector");
                setInspectorCollapsed(size.asPercentage === 0);
              }}
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
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            editorContentRef.current
              ?.querySelector<HTMLInputElement>("input")
              ?.focus();
          }}
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
            <div className="flex shrink-0 items-center gap-0.5">
              <IconAction label="Скачать сохранённую карточку" onClick={downloadTaskBrief}>
                <ArrowDownToLine className="size-4" />
              </IconAction>
              <IconAction
                label="Закрыть карточку"
                shortcut="Esc · Alt + 2"
                onClick={() => setCardOpen(false)}
              >
                <Xmark className="size-4" />
              </IconAction>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <TaskEditor
              key={task.id}
              task={task}
              savedTask={canonicalTask}
              draftCache={editorDrafts}
              onSave={saveTask}
              onCancel={() => setCardOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={documentsOpen && role === "business"} onOpenChange={setDocumentsOpen}>
        <SheetContent
          ref={documentsContentRef}
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[600px]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            documentsContentRef.current?.querySelector<HTMLButtonElement>("button[aria-controls]")?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const previous = documentsReturnFocus.current;
            if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
            else document.getElementById("chat-message")?.focus();
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
            <div className="min-w-0">
              <SheetTitle className="text-sm font-semibold">Документы задачи</SheetTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground" title={task.title}>{task.title}</p>
            </div>
            <IconAction label="Закрыть документы" shortcut="Esc · Alt + 4" onClick={() => setDocumentsOpen(false)}>
              <Xmark className="size-4" />
            </IconAction>
          </div>
          <SheetDescription className="sr-only">Рабочие материалы текущей задачи. Документы доступны только в этой вкладке.</SheetDescription>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <TaskDocumentsPanel
              key={task.id}
              documents={taskDocuments.documents}
              error={taskDocuments.error}
              onAdd={taskDocuments.addDocuments}
              onRemove={taskDocuments.removeDocument}
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
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const content = mobileContentRef.current;
            const search = content?.querySelector<HTMLInputElement>("input");
            if (search) search.focus();
            else content?.focus();
          }}
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
                    ["Alt + 4", "Открыть / закрыть документы"],
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
        onCreate={async (description) => {
          const next = await workspaceApi.createTask(description);
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
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              AI-Sana
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              От бизнес-задачи до выбранной команды.
              Ассистент отвечает по подготовленным сценариям.
            </DialogDescription>
          </DialogHeader>
          <ol className="my-2 space-y-3 text-xs leading-relaxed">
            {[
              "Создайте задачу, ответьте на вопросы и подтвердите карточку.",
              "Команды находят задачи в каталоге и предлагают решения.",
              "Сравните отклики и выберите команды, с которыми хотите работать.",
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
            Карточки, отклики и решения сохраняются. Переписка и прикреплённые документы доступны только в текущей вкладке.
          </p>
          <Button variant="outline" disabled={switching} onClick={refreshWorkspace} className="mt-2">
            Обновить сохранённые данные
          </Button>
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-center" closeButton />
    </div>
  );
}
