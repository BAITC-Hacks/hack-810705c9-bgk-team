"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUp,
  At,
  FileText,
  Keyboard,
  Persons,
  Xmark,
} from "@gravity-ui/icons";
import {
  calculateScore,
  suggestQuestions,
  TASK_FIELDS,
  type Message,
  type Task,
  type TaskField,
} from "@/entities/workspace";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/shared/components/ai-elements/conversation";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  CHAT_SKILLS,
  getMentionRange,
  removeMention,
  type ChatSkillId,
} from "./chat-skills";

type Props = {
  task: Task;
  messages: Message[];
  onSend: (text: string, field?: TaskField, skill?: ChatSkillId) => void;
  currentQuestion?: { field: TaskField; question: string } | null;
  onEdit: () => void;
  onShowProposals: () => void;
  onShowShortcuts: () => void;
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
    id: "proposals",
    label: "Открыть отклики",
    description: "Посмотреть прототипы и выбрать команды",
    aliases: ["proposals", "отклики"],
    kind: "action" as const,
  },
];

type ChatOption = (typeof CHAT_OPTIONS)[number];

export function ChatPanel({
  task,
  messages,
  currentQuestion,
  onSend,
  onEdit,
  onShowProposals,
  onShowShortcuts,
}: Props) {
  const [input, setInput] = useState("");
  const [answerField, setAnswerField] = useState<TaskField | undefined>();
  const [selectedSkill, setSelectedSkill] = useState<ChatSkillId | undefined>();
  const [menuMode, setMenuMode] = useState<"mention" | "manual" | null>(null);
  const [caret, setCaret] = useState(0);
  const [activeOption, setActiveOption] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const menuId = useId();
  const questions = currentQuestion === undefined
    ? suggestQuestions(task)
    : currentQuestion ? [currentQuestion] : [];
  const score = calculateScore(task);
  const field = TASK_FIELDS.find((item) => item.key === answerField);
  const skill = CHAT_SKILLS.find((item) => item.id === selectedSkill);
  const mention = getMentionRange(input, caret);
  const menuOpen =
    menuMode === "manual" || (menuMode === "mention" && !!mention);
  const query =
    menuMode === "mention"
      ? (mention?.query.toLocaleLowerCase("ru") ?? "")
      : "";
  const options = CHAT_OPTIONS.filter((option) =>
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

  function pickOption(option: ChatOption) {
    const updatedInput =
      mention && menuMode === "mention" ? removeMention(input, mention) : input;
    const nextCaret = mention && menuMode === "mention" ? mention.start : caret;
    setInput(updatedInput);
    setCaret(nextCaret);
    setMenuMode(null);
    if (option.kind === "action") {
      if (option.id === "card") onEdit();
      else onShowProposals();
      return;
    }
    setSelectedSkill(option.id);
    setAnswerField(undefined);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function send() {
    if (!input.trim() && !selectedSkill) return;
    onSend(
      input.trim(),
      selectedSkill ? undefined : currentQuestion === undefined ? answerField : currentQuestion?.field,
      selectedSkill,
    );
    setInput("");
    setAnswerField(undefined);
    setSelectedSkill(undefined);
    setMenuMode(null);
    setCaret(0);
    inputRef.current?.focus();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 overflow-hidden">
        <ConversationContent
          scrollClassName="workspace-scroll"
          className="mx-auto w-full max-w-[960px] gap-7 px-5 py-7 lg:px-10"
        >
          <div className="ml-auto max-w-[85%]">
            <p className="mb-2 text-right text-xs font-medium text-muted-foreground">
              Вы · исходная идея
            </p>
            <div className="rounded-2xl bg-secondary px-5 py-4 text-[15px] leading-[1.7]">
              {task.description}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[15px] font-bold">AI-Sana</span>
                <span className="text-xs text-muted-foreground">
                  Демо-ассистент
                </span>
              </div>
              <p className="text-[15px] leading-[1.7]">
                {score === 100
                  ? "Всё важное уже в карточке. Можно перейти к предложениям команд или уточнить детали задачи."
                  : "Выберите вопрос, чтобы дополнить карточку задачи."}
              </p>
              {questions.length > 0 && (
                <>
                  <div className="mt-4 space-y-2">
                    {questions.map((question, index) => (
                      <button
                        type="button"
                        key={question.field}
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
            </div>
          </div>
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "workspace-enter flex gap-3",
                message.role === "user" && "justify-end",
              )}
            >
              <div
                className={cn(
                  "max-w-[90%] whitespace-pre-wrap text-[15px] leading-[1.7]",
                  message.role === "user"
                    ? "rounded-2xl bg-secondary px-5 py-4"
                    : "pt-1",
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
        </ConversationContent>
        <ConversationScrollButton aria-label="К последнему сообщению" />
      </Conversation>
      <div className="mx-auto w-full max-w-[960px] shrink-0 px-4 pt-3 pb-3 lg:px-9">
        <form
          ref={composerRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setMenuMode(null);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="relative rounded-2xl border border-input bg-card p-3.5 shadow-[0_2px_8px_#00000006] transition-shadow focus-within:border-primary/45 focus-within:shadow-[0_2px_12px_#0000000a] focus-within:ring-2 focus-within:ring-primary/5"
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
                        {option.kind === "skill" ? (
                          <At className="size-4" />
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
          {skill && (
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-workspace-selected py-1 pl-2.5 pr-1 text-xs font-semibold">
              <At className="size-3.5 shrink-0" />
              <span className="truncate">{skill.label}</span>
              <button
                type="button"
                aria-label={`Убрать навык: ${skill.label}`}
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
                className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-workspace-selected focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Xmark className="size-3" />
              </button>
            </div>
          )}
          <label htmlFor="chat-message" className="sr-only">
            {field ? `Ответ: ${field.label}` : "Сообщение ассистенту"}
          </label>
          <textarea
            id="chat-message"
            ref={inputRef}
            value={input}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-activedescendant={menuOpen ? activeOptionId : undefined}
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
            rows={2}
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
                aria-label="Открыть карточку задачи"
                title="Карточка задачи"
                onClick={onEdit}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <FileText className="size-[18px]" />
              </Button>
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
              <span className="hidden text-[11px] text-muted-foreground xl:inline">
                Shift + Enter ↵
              </span>
              <Button
                size="icon"
                type="submit"
                aria-label="Отправить сообщение"
                disabled={!input.trim() && !selectedSkill}
                className="size-9 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              >
                <ArrowUp className="size-[18px]" />
              </Button>
            </div>
          </div>
        </form>
        <p className="mt-2 text-center text-[11px] leading-normal text-muted-foreground">
          Демо-ответы. Проверьте карточку перед публикацией.
        </p>
      </div>
    </div>
  );
}
