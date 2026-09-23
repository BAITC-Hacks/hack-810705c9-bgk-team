"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import {
  ArrowDown,
  ArrowUp,
  At,
  FileText,
  Keyboard,
  Paperclip,
  Persons,
  Xmark,
} from "@gravity-ui/icons";
import {
  suggestQuestions,
  CHAT_ATTACHMENT_LIMIT,
  TASK_FIELDS,
  type ChatAttachment,
  type Message,
  type Task,
  type TaskField,
} from "@/entities/workspace";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import {
  CHAT_SKILLS,
  getMentionRange,
  removeMention,
  type ChatSkillId,
} from "./chat-skills";
import { Spinner } from "@/shared/components/ui/spinner";
import { AssistantAvatar, AssistantMessage, UserMessage } from "./chat-messages";
import { CHAT_ATTACHMENT_ACCEPT, useChatAttachments } from "./use-chat-attachments";
import { analyzeTaskLocally } from "./local-ai-analysis";
import { useAsyncAction } from "@/shared/hooks/use-async-action";

type Props = {
  task: Task;
  messages: Message[];
  pending?: boolean;
  onSend: (text: string, field?: TaskField, skill?: ChatSkillId, attachments?: ChatAttachment[]) => void | Promise<void>;
  onAddDocuments: (files: File[]) => void;
  onEdit: () => void;
  onShowProposals: () => void;
  onShowShortcuts: () => void;
  onGrill: () => void;
  onEvaluate: () => void;
  onShowDocuments: () => void;
};

const CHAT_OPTIONS = [
  ...CHAT_SKILLS.map((skill) => ({ ...skill, kind: "skill" as const })),
  {
    id: "card",
    label: "Открыть карточку",
    description: "Проверить, изменить и подтвердить сведения",
    aliases: ["card", "edit", "карточка"],
    kind: "action" as const,
  },
  {
    id: "documents",
    label: "Документы задачи",
    description: "Добавить и просмотреть рабочие материалы",
    aliases: ["docs", "files", "документы", "файлы"],
    kind: "action" as const,
  },
  {
    id: "proposals",
    label: "Открыть отклики",
    description: "Посмотреть прототипы и выбрать команды",
    aliases: ["proposals", "отклики"],
    kind: "action" as const,
  },
  {
    id: "grill",
    label: "Запустить прожарку",
    description: "Воркфлоу: из сырой идеи собрать правильную задачу",
    aliases: ["grill", "прожарка", "workflow"],
    kind: "action" as const,
  },
  {
    id: "evaluate",
    label: "Оценить задачу",
    description: "Пересчитать рейтинг агентом-оценщиком",
    aliases: ["evaluate", "оцен", "рейтинг", "rating"],
    kind: "action" as const,
  },
];

type SkillOrActionOption = (typeof CHAT_OPTIONS)[number];
type QuestionOption = {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  kind: "question";
  field: TaskField;
};
type ChatOption = SkillOrActionOption | QuestionOption;

type Submit = (
  text: string,
  field?: TaskField,
  skill?: ChatSkillId,
  attachments?: ChatAttachment[],
) => Promise<boolean>;

const PENDING_MESSAGE_ID = "pending-user-message";

function convertMessage(message: Message): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map((attachment, index) => ({
      id: `${message.id}-attachment-${index}`,
      type: "document",
      name: attachment.name,
      status: { type: "complete" },
      content: [],
    })),
  };
}

function appendedText(message: AppendMessage) {
  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

/** assistant-ui renders the thread; the workspace page stays the owner of message history. */
export function ChatPanel(props: Props) {
  const { messages, onSend } = props;
  const { pending, error, run } = useAsyncAction();
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null);
  const threadMessages = useMemo(
    () => pending && pendingMessage ? [...messages, pendingMessage] : messages,
    [messages, pending, pendingMessage],
  );

  const submit = useCallback<Submit>(async (text, field, skill, attachments) => {
    const skillLabel = CHAT_SKILLS.find((item) => item.id === skill)?.label;
    setPendingMessage({
      id: PENDING_MESSAGE_ID,
      role: "user",
      content: skill ? `@${skillLabel}${text ? `\n${text}` : ""}` : text,
      ...(attachments?.length ? { attachments } : {}),
    });
    try {
      return await run(() => onSend(text, field, skill, attachments));
    } finally {
      setPendingMessage(null);
    }
  }, [onSend, run]);

  const runtime = useExternalStoreRuntime<Message>({
    messages: threadMessages,
    isRunning: pending,
    convertMessage,
    onNew: async (message) => {
      await submit(appendedText(message));
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatThread {...props} pending={pending} error={error} submit={submit} />
    </AssistantRuntimeProvider>
  );
}

function ChatThread({
  task,
  messages,
  onEdit,
  onShowProposals,
  onShowShortcuts,
  onShowDocuments,
  onAddDocuments,
  onGrill,
  onEvaluate,
  pending,
  error,
  submit,
}: Omit<Props, "onSend"> & { pending: boolean; error: string; submit: Submit }) {
  const aui = useAui();
  const input = useAuiState((state) => state.composer.text);
  const setInput = useCallback((text: string) => aui.composer.setText(text), [aui]);
  const composerBusy = pending;
  const files = useChatAttachments(task.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [answerField, setAnswerField] = useState<TaskField | undefined>();
  const [selectedSkill, setSelectedSkill] = useState<ChatSkillId | undefined>();
  const [menuMode, setMenuMode] = useState<"mention" | "manual" | null>(null);
  const [caret, setCaret] = useState(0);
  const [activeOption, setActiveOption] = useState(0);
  const [simulateMalformed, setSimulateMalformed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const menuId = useId();
  // Вопросы карточки — динамические опции @-меню вместо статичного блока в чате.
  const questionOptions: QuestionOption[] = suggestQuestions(task).map(
    ({ field, question }) => {
      const meta = TASK_FIELDS.find((item) => item.key === field);
      return {
        id: `field:${field}`,
        label: meta?.label ?? field,
        description: question,
        aliases: [meta?.label ?? field, field],
        kind: "question",
        field,
      };
    },
  );
  const analysis = analyzeTaskLocally(task);
  const { questions, pendingConfirmation } = analysis.output;
  const displayedAnalysis = simulateMalformed
    ? analyzeTaskLocally(task, '{"questions": [')
    : analysis;
  const field = TASK_FIELDS.find((item) => item.key === answerField);
  const skill = CHAT_SKILLS.find((item) => item.id === selectedSkill);
  const mention = getMentionRange(input, caret);
  const menuOpen =
    menuMode === "manual" || (menuMode === "mention" && !!mention);
  const query =
    menuMode === "mention"
      ? (mention?.query.toLocaleLowerCase("ru") ?? "")
      : "";
  const options: ChatOption[] = [...questionOptions, ...CHAT_OPTIONS].filter((option) =>
    [option.label, ...option.aliases].some((value) =>
      value.toLocaleLowerCase("ru").includes(query),
    ),
  );
  const activeIndex = Math.min(activeOption, Math.max(0, options.length - 1));
  const activeOptionId = options[activeIndex]
    ? `${menuId}-${options[activeIndex].id}`
    : undefined;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!composerRef.current?.contains(event.target as Node))
        setMenuMode(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !activeOptionId) return;
    document
      .getElementById(activeOptionId)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId, menuOpen]);

  const hasFiles = files.items.length > 0;
  const filesLockedReason = "Сообщение с файлами отправляется помощнику целиком. Уберите файлы, чтобы ответить на вопрос или выбрать навык.";

  function attachFiles(list: FileList | File[] | null | undefined) {
    const picked = Array.from(list ?? []);
    if (!picked.length || composerBusy || selectedSkill || answerField) return;
    const accepted = files.add(picked);
    // Chat files also appear in the task's documents panel.
    if (accepted.length) onAddDocuments(accepted);
  }

  function pickOption(option: ChatOption) {
    if (composerBusy || (option.kind === "skill" && hasFiles)) return;
    const updatedInput =
      mention && menuMode === "mention" ? removeMention(input, mention) : input;
    const nextCaret = mention && menuMode === "mention" ? mention.start : caret;
    setInput(updatedInput);
    setCaret(nextCaret);
    setMenuMode(null);
    if (option.kind === "action") {
      if (option.id === "card") onEdit();
      else if (option.id === "grill") onGrill();
      else if (option.id === "evaluate") onEvaluate();
      else if (option.id === "documents") onShowDocuments();
      else onShowProposals();
      return;
    }
    if (option.kind === "question") {
      setAnswerField(option.field);
      setSelectedSkill(undefined);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setSelectedSkill(option.id);
    setAnswerField(undefined);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  const canSend = !composerBusy && !files.reading && !files.failed
    && (!!input.trim() || !!selectedSkill || files.attachments.length > 0);

  async function send() {
    if (!canSend) return;
    const draft = { text: input, field: answerField, skill: selectedSkill, files: files.items };
    const attachments = files.attachments;
    // Clear optimistically like a chat; restore the draft if the turn fails.
    setInput("");
    setAnswerField(undefined);
    setSelectedSkill(undefined);
    setMenuMode(null);
    setCaret(0);
    files.reset();
    const sent = await submit(
      draft.text.trim(),
      draft.skill ? undefined : draft.field,
      draft.skill,
      attachments.length ? attachments : undefined,
    );
    if (!sent) {
      setInput(draft.text);
      setAnswerField(draft.field);
      setSelectedSkill(draft.skill);
      files.reset(draft.files);
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  return (
    <ThreadPrimitive.Root className="relative flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport className="workspace-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-7 px-5 py-7 lg:px-10">
          <div className="ml-auto max-w-[85%]">
            <p className="mb-2 text-right text-xs font-medium text-muted-foreground">
              Вы · исходная идея
            </p>
            <div className="rounded-2xl bg-secondary px-5 py-4 text-[15px] leading-[1.7]">
              {task.description}
            </div>
          </div>
          {messages.length === 0 && !pending && (
            <div className="max-w-[92%] rounded-xl border border-dashed bg-muted/40 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
              Напишите сообщение — ответит AI-Sana (ответы идут через Mastra по
              данным карточки). Команды и навыки запускаются через{" "}
              <kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-medium text-foreground">
                @
              </kbd>
              : «Запустить прожарку», «Оценить задачу», «Открыть карточку» и
              вопросы по заполнению карточки.
              <div className="mt-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMenuMode("manual");
                    setActiveOption(0);
                    inputRef.current?.focus();
                  }}
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                >
                  <At className="size-3.5" />
                  Показать команды
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <AssistantAvatar />
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[15px] font-bold">AI-Sana</span>
                <Dialog onOpenChange={(open) => { if (!open) setSimulateMalformed(false); }}>
                  <DialogTrigger asChild>
                    <button type="button" className="rounded text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
                      О помощнике
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader className="pr-7">
                      <DialogTitle className="font-semibold">Как работает помощник</DialogTitle>
                      <DialogDescription>
                        Помощник находит пустые поля и предлагает уточняющие вопросы. Ответы сохраняются без изменений, а сведения подтверждаете вы. Текст прикреплённых к сообщению файлов (до 10 000 символов из каждого) передаётся помощнику вместе с вопросом.
                      </DialogDescription>
                    </DialogHeader>
                    <details className="space-y-3 rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm font-semibold">Технические сведения</summary>
                      <p className="text-xs leading-relaxed text-muted-foreground">Уточняющие вопросы и навыки используют локальные шаблоны. Свободные сообщения отправляются через сервер настроенному помощнику; если он недоступен, поле показывает ошибку и сохраняет ваш ввод.</p>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3">
                      <p role="status" className="text-sm font-medium">
                        {displayedAnalysis.fallbackUsed ? "Ошибка обработана · использованы безопасные вопросы" : "Ответ проверен · шаблон выполнен"}
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSimulateMalformed((value) => !value)}>
                        {simulateMalformed ? "Вернуть корректный ответ" : "Показать обработку ошибки"}
                      </Button>
                    </div>
                    {displayedAnalysis.error && (
                      <p className="text-sm text-muted-foreground">{displayedAnalysis.error} Продолжаем со стандартными вопросами; карточка и ответы сохранены.</p>
                    )}
                    <AiContractDetails label="Промпт" value={displayedAnalysis.prompt} />
                    <AiContractDetails label="Вход · JSON" value={JSON.stringify(displayedAnalysis.input, null, 2)} />
                    <AiContractDetails label="Исходный ответ · JSON" value={displayedAnalysis.rawOutput} />
                    <AiContractDetails label="Проверенный результат и статус" value={JSON.stringify({ output: displayedAnalysis.output, parse_ok: displayedAnalysis.parseOk, fallback_used: displayedAnalysis.fallbackUsed }, null, 2)} />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      При неверном JSON, неизвестных полях или повторных вопросах ответ заменяется локальным шаблоном. Заполненные поля ждут подтверждения человека, а рейтинг пересчитывается сервером после подтверждения полей.
                    </p>
                    </details>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-[15px] leading-[1.7]">
                {questions.length
                  ? "Выберите вопрос, чтобы дополнить карточку задачи."
                  : pendingConfirmation.length
                    ? "Все ответы уже в карточке. Проверьте и подтвердите их, чтобы обновить готовность задачи."
                    : task.status === "draft"
                      ? "Карточка заполнена и подтверждена. Осталось опубликовать задачу для студентов."
                      : "Всё важное уже в карточке. Можно перейти к предложениям команд или уточнить детали задачи."}
              </p>
              <div className="mt-4 rounded-lg border p-3">
                <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                  Здесь доступны локальные подсказки и файлы к сообщению. Прожарка с сохранением сессии,
                  подтверждением полей и критериев открывается отдельно.
                </p>
                <Button asChild size="sm" variant="outline">
                  <a href={`/task-match?task=${encodeURIComponent(task.id)}`}>Открыть прожарку и критерии</a>
                </Button>
              </div>
              {questions.length > 0 && (
                <>
                  <div className="mt-4 space-y-2">
                    {questions.map((question, index) => (
                      <button
                        type="button"
                        key={question.field}
                        disabled={composerBusy || hasFiles}
                        title={hasFiles ? filesLockedReason : undefined}
                        aria-pressed={answerField === question.field}
                        onClick={() => {
                          setAnswerField(question.field);
                          setSelectedSkill(undefined);
                          setMenuMode(null);
                          inputRef.current?.focus();
                        }}
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          answerField === question.field
                            ? "border-primary/35 bg-workspace-selected"
                            : "border-transparent bg-muted/70 hover:bg-workspace-selected",
                        )}
                      >
                        <span className="mt-0.5 w-3 shrink-0 text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="flex-1 text-sm leading-[1.6] font-medium">
                          {question.question}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {questions.length === 0 ? (
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={pendingConfirmation.length || task.status === "draft" ? onEdit : onShowProposals}>
                  {pendingConfirmation.length ? "Проверить и подтвердить ответы" : task.status === "draft" ? "Опубликовать карточку" : "Открыть отклики"}
                </Button>
              ) : pendingConfirmation.length > 0 && (
                <button type="button" onClick={onEdit} className="mt-3 rounded text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
                  Проверить внесённые ответы · {pendingConfirmation.length}
                </button>
              )}
            </div>
          </div>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </div>
      </ThreadPrimitive.Viewport>
      <div className="relative mx-auto w-full max-w-[960px] shrink-0 px-4 pt-3 pb-3 lg:px-9">
        <ThreadPrimitive.ScrollToBottom asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="К последнему сообщению"
            className="absolute -top-11 left-1/2 z-10 size-9 -translate-x-1/2 rounded-full bg-card shadow-sm disabled:invisible"
          >
            <ArrowDown className="size-4" />
          </Button>
        </ThreadPrimitive.ScrollToBottom>
        {error && <p id="chat-save-error" role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
        <ComposerPrimitive.Root
          ref={composerRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setMenuMode(null);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.types).includes("Files")) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.files.length) return;
            event.preventDefault();
            setDragging(false);
            attachFiles(event.dataTransfer.files);
          }}
          onPaste={(event) => {
            if (!event.clipboardData.files.length) return;
            event.preventDefault();
            attachFiles(event.clipboardData.files);
          }}
          data-dragging={dragging || undefined}
          className="relative rounded-2xl border border-input bg-card p-3.5 data-dragging:border-dashed data-dragging:border-primary data-dragging:bg-workspace-selected shadow-[0_2px_8px_#00000006] transition-shadow focus-within:border-primary/45 focus-within:shadow-[0_2px_12px_#0000000a] focus-within:ring-2 focus-within:ring-primary/5"
        >
          {menuOpen && (
            <div className="absolute right-0 bottom-[calc(100%+8px)] left-0 z-30 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-[0_8px_32px_#00000016]">
              <div className="flex items-center justify-between px-3 pt-2 pb-2.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  Навыки и действия
                </span>
                <span className="text-[11px] text-muted-foreground">
                  ↑↓ · Enter · Esc
                </span>
              </div>
              <div
                id={menuId}
                role="listbox"
                aria-label="Навыки и действия"
                className="max-h-[min(360px,45vh)] overflow-y-auto"
              >
                {options.length ? (
                  options.map((option, index) => (
                    <button
                      type="button"
                      key={option.id}
                      disabled={composerBusy || (option.kind === "skill" && hasFiles)}
                      title={option.kind === "skill" && hasFiles ? filesLockedReason : undefined}
                      id={`${menuId}-${option.id}`}
                      role="option"
                      aria-selected={activeIndex === index}
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveOption(index)}
                      onClick={() => pickOption(option)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                        activeIndex === index && "bg-workspace-selected",
                      )}
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
                        aria-hidden="true"
                      >
                        {option.kind === "skill" || option.kind === "question" ? (
                          <At className="size-4" />
                        ) : option.id === "documents" ? (
                          <Paperclip className="size-4" />
                        ) : option.id === "card" ? (
                          <FileText className="size-4" />
                        ) : (
                          <Persons className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p
                    role="status"
                    className="px-3 py-5 text-sm text-muted-foreground"
                  >
                    Нет подходящих навыков. Попробуйте «готовность» или
                    «отклики».
                  </p>
                )}
              </div>
            </div>
          )}
          {files.items.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2" aria-label="Файлы сообщения">
              {files.items.map((item) => (
                <li
                  key={item.id}
                  title={item.error ?? (item.result?.truncated ? "Файл длинный: помощник получит первые 10 000 символов." : item.file.name)}
                  className={cn(
                    "flex max-w-64 items-center gap-2 rounded-xl border py-1.5 pr-1 pl-2",
                    item.status === "error" ? "border-destructive/40 bg-destructive/5" : "bg-muted/60",
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background" aria-hidden="true">
                    {item.status === "reading" ? <Spinner className="size-3.5" /> : <FileText className="size-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{item.file.name}</span>
                    <span className={cn("block truncate text-[11px]", item.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                      {item.status === "reading"
                        ? "Читаю файл…"
                        : item.status === "error"
                          ? item.error
                          : item.result?.truncated
                            ? "Готово · первые 10 000 символов"
                            : item.result?.text
                              ? "Готово"
                              : "Текст не найден"}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Убрать файл ${item.file.name}`}
                    disabled={composerBusy}
                    onClick={() => files.remove(item.id)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Xmark className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.notice && (
            <p role="alert" className="mb-2 text-xs whitespace-pre-line text-destructive">{files.notice}</p>
          )}
          {skill && (
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-workspace-selected py-1 pl-2.5 pr-1 text-xs font-semibold">
              <At className="size-3.5 shrink-0" />
              <span className="truncate">{skill.label}</span>
              <button
                type="button"
                aria-label={`Убрать навык: ${skill.label}`}
                disabled={composerBusy}
                onClick={() => {
                  setSelectedSkill(undefined);
                  inputRef.current?.focus();
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Xmark className="size-3" />
              </button>
            </div>
          )}
          {field && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-primary">
              <span>Уточняем: {field.label}</span>
              <button
                type="button"
                onClick={() => setAnswerField(undefined)}
                aria-label="Отменить выбор вопроса"
                disabled={composerBusy}
                className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-workspace-selected focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Xmark className="size-3" />
              </button>
            </div>
          )}
          <label htmlFor="chat-message" className="sr-only">
            {field ? `Ответ: ${field.label}` : "Сообщение ассистенту"}
          </label>
          <ComposerPrimitive.Input
            disabled={pending}
            id="chat-message"
            ref={inputRef}
            submitMode="none"
            cancelOnEscape={false}
            addAttachmentOnPaste={false}
            minRows={2}
            maxRows={12}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-activedescendant={menuOpen ? activeOptionId : undefined}
            aria-describedby={error ? "chat-save-error" : undefined}
            onChange={(event) => {
              const value = event.target.value;
              const position = event.target.selectionStart;
              setInput(value);
              setCaret(position);
              setActiveOption(0);
              setMenuMode(getMentionRange(value, position) ? "mention" : null);
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229)
                return;
              if (menuOpen) {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenuMode(null);
                  return;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveOption(
                    (activeIndex +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      options.length) %
                      Math.max(1, options.length),
                  );
                  return;
                }
                if (
                  (event.key === "Enter" && !event.shiftKey) ||
                  (event.key === "Tab" && !event.shiftKey)
                ) {
                  if (options.length) {
                    event.preventDefault();
                    pickOption(options[activeIndex]);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                  } else setMenuMode(null);
                  return;
                }
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            maxLength={4000}
            placeholder={
              field
                ? "Напишите ответ своими словами…"
                : skill
                  ? "Добавьте уточнение или отправьте навык…"
                  : "Опишите задачу. @ — навыки и действия"
            }
            className="block min-h-14 w-full resize-none border-0 bg-transparent px-1 py-1 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Навыки и действия"
                disabled={composerBusy}
                title="Навыки и действия (@)"
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuMode(menuOpen ? null : "manual");
                  setActiveOption(0);
                  inputRef.current?.focus();
                }}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <At className="size-[18px]" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Прикрепить файлы"
                disabled={composerBusy || !!selectedSkill || !!answerField || files.items.length >= CHAT_ATTACHMENT_LIMIT}
                title={selectedSkill || answerField
                  ? "Файлы можно прикрепить к обычному сообщению"
                  : "Прикрепить файлы · PDF, DOCX, XLSX, PPTX, RTF, TXT, MD, CSV · до 3 файлов по 10 МБ"}
                onClick={() => fileInputRef.current?.click()}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="size-[18px]" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept={CHAT_ATTACHMENT_ACCEPT}
                onChange={(event) => {
                  attachFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Горячие клавиши"
                title="Горячие клавиши"
                onClick={onShowShortcuts}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <Keyboard className="size-[18px]" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {input.length >= 3900 && <span className="text-[11px] text-muted-foreground tabular-nums">{input.length} / 4000</span>}
              <span className="hidden text-[11px] text-muted-foreground xl:inline">
                Shift + Enter ↵
              </span>
              <Button
                size="icon"
                type="submit"
                aria-label="Отправить сообщение"
                disabled={!canSend}
                className="size-9 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              >
                <ArrowUp className="size-[18px]" />
              </Button>
            </div>
          </div>
        </ComposerPrimitive.Root>
        <p className="mt-2 text-center text-[11px] leading-normal text-muted-foreground">
          Ответы ИИ по данным карточки. Проверьте и подтвердите карточку перед публикацией.
        </p>
      </div>
    </ThreadPrimitive.Root>
  );
}

function AiContractDetails({ label, value }: { label: string; value: string }) {
  return (
    <details className="rounded-lg border px-3 py-2.5">
      <summary className="cursor-pointer text-sm font-semibold">{label}</summary>
      <pre className="mt-3 max-h-64 overflow-y-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">{value}</pre>
    </details>
  );
}
