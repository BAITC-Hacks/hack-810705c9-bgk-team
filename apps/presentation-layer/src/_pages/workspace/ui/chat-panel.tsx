"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUp,
  At,
  FileText,
  Keyboard,
  Microphone,
  Persons,
  StopFill,
  Xmark,
} from "@gravity-ui/icons";
import {
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
import { analyzeTaskLocally } from "./local-ai-analysis";
import { useAsyncAction } from "@/shared/hooks/use-async-action";
import { useSpeechInput } from "@/shared/hooks/use-speech-input";
import { appendVoiceTranscript } from "@/shared/lib/speech-recognition";

type Props = {
  task: Task;
  messages: Message[];
  onSend: (text: string, field?: TaskField, skill?: ChatSkillId) => void | Promise<void>;
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
  onSend,
  onEdit,
  onShowProposals,
  onShowShortcuts,
}: Props) {
  const [input, setInput] = useState("");
  const inputValueRef = useRef("");
  const [voiceRemainder, setVoiceRemainder] = useState("");
  const { pending, error, run } = useAsyncAction();
  const voice = useSpeechInput(task.id, (text) => {
    const result = appendVoiceTranscript(inputValueRef.current, text);
    inputValueRef.current = result.text;
    setInput(result.text);
    if (result.remainder) {
      setVoiceRemainder((current) => [current, result.remainder].filter(Boolean).join(" "));
    }
  });
  const { busy: voiceBusy, stop: stopVoice } = voice;
  const composerBusy = pending || voice.busy;
  const [answerField, setAnswerField] = useState<TaskField | undefined>();
  const [selectedSkill, setSelectedSkill] = useState<ChatSkillId | undefined>();
  const [menuMode, setMenuMode] = useState<"mention" | "manual" | null>(null);
  const [caret, setCaret] = useState(0);
  const [activeOption, setActiveOption] = useState(0);
  const [simulateMalformed, setSimulateMalformed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const menuId = useId();
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
  const options = CHAT_OPTIONS.filter((option) =>
    [option.label, ...option.aliases].some((value) =>
      value.toLocaleLowerCase("ru").includes(query),
    ),
  );
  const activeIndex = Math.min(activeOption, Math.max(0, options.length - 1));
  const activeOptionId = options[activeIndex]
    ? `${menuId}-${options[activeIndex].id}`
    : undefined;

  useEffect(() => { inputValueRef.current = input; }, [input]);

  useEffect(() => {
    if (voiceRemainder && voiceBusy) stopVoice();
  }, [voiceRemainder, voiceBusy, stopVoice]);

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
    if (composerBusy) return;
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

  async function send() {
    if (composerBusy || voiceRemainder) return;
    if (!input.trim() && !selectedSkill) return;
    if (!await run(() => onSend(
      input.trim(),
      selectedSkill ? undefined : answerField,
      selectedSkill,
    ))) return;
    setInput("");
    setAnswerField(undefined);
    setSelectedSkill(undefined);
    setMenuMode(null);
    setCaret(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-voice-active={voice.busy}>
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
                <Dialog onOpenChange={(open) => { if (!open) setSimulateMalformed(false); }}>
                  <DialogTrigger asChild>
                    <button type="button" disabled={voice.busy} className="rounded text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
                      Демо-ассистент
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader className="pr-7">
                      <DialogTitle className="font-semibold">Локальный демо-ассистент</DialogTitle>
                      <DialogDescription>
                        Ответ формируется по шаблону и проверяется перед показом. Внешняя модель не вызывается. Здесь можно проверить формат и обработку ошибки.
                      </DialogDescription>
                    </DialogHeader>
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
                      При неверном JSON, неизвестных полях или повторных вопросах ответ заменяется локальным шаблоном. Заполненные поля ждут подтверждения человека, а рейтинг и выбор команд остаются в интерфейсе.
                    </p>
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
              {questions.length > 0 && (
                <>
                  <div className="mt-4 space-y-2">
                    {questions.map((question, index) => (
                      <button
                        type="button"
                        key={question.field}
                        disabled={composerBusy}
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
                <Button type="button" variant="outline" size="sm" disabled={voice.busy} className="mt-4" onClick={pendingConfirmation.length || task.status === "draft" ? onEdit : onShowProposals}>
                  {pendingConfirmation.length ? "Проверить и подтвердить ответы" : task.status === "draft" ? "Опубликовать карточку" : "Открыть отклики"}
                </Button>
              ) : pendingConfirmation.length > 0 && (
                <button type="button" disabled={voice.busy} onClick={onEdit} className="mt-3 rounded text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
                  Проверить внесённые ответы · {pendingConfirmation.length}
                </button>
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
        {error && <p id="chat-save-error" role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
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
                      disabled={composerBusy}
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
          <textarea
            disabled={pending}
            readOnly={voice.busy}
            id="chat-message"
            ref={inputRef}
            value={input}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-activedescendant={menuOpen ? activeOptionId : undefined}
            aria-describedby={[error && "chat-save-error", voice.message && "chat-voice-status", voiceRemainder && "chat-voice-remainder"].filter(Boolean).join(" ") || undefined}
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
              if (voice.busy) {
                if (event.key === "Enter") event.preventDefault();
                return;
              }
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
                aria-label="Открыть карточку задачи"
                disabled={voice.busy}
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
                disabled={voice.busy}
                title="Горячие клавиши"
                onClick={onShowShortcuts}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <Keyboard className="size-[18px]" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={voice.busy ? "Остановить диктовку" : "Ввести голосом"}
                aria-pressed={voice.busy}
                disabled={pending || voice.phase === "stopping" || (!voice.busy && (!!voiceRemainder || input.length >= 4000))}
                title={voice.busy ? "Остановить диктовку" : voiceRemainder ? "Сначала проверьте не поместившуюся фразу" : input.length >= 4000 ? "Лимит 4000 символов. Сократите текст для диктовки." : "Ввести голосом. Браузер может передавать звук сервису распознавания; нужен доступ к микрофону и может понадобиться интернет."}
                onClick={() => {
                  setMenuMode(null);
                  if (voice.busy) voice.stop();
                  else voice.start();
                }}
                className={cn("size-8 rounded-lg", voice.busy ? "bg-foreground text-background hover:bg-foreground/85 hover:text-background" : "text-muted-foreground hover:text-foreground")}
              >
                {voice.busy ? <StopFill className="size-4" /> : <Microphone className="size-[18px]" />}
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
                disabled={composerBusy || !!voiceRemainder || (!input.trim() && !selectedSkill)}
                className="size-9 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              >
                <ArrowUp className="size-[18px]" />
              </Button>
            </div>
          </div>
          {voice.message && (
            <div id="chat-voice-status" className="mt-3 border-t pt-2.5 text-xs leading-relaxed text-muted-foreground">
              <p role={voice.phase === "error" || voice.phase === "unsupported" ? "alert" : "status"} className="font-medium text-foreground">{voice.message}</p>
              {voice.interim && <p className="mt-1 max-h-16 overflow-y-auto">Распознаётся: {voice.interim}</p>}
              {voice.busy && <p className="mt-1">Браузер может передавать звук сервису распознавания. Отправка сообщения — только вручную.</p>}
            </div>
          )}
          {voiceRemainder && (
            <div id="chat-voice-remainder" className="mt-3 rounded-lg border bg-muted p-3 text-xs leading-relaxed">
              <p role="alert" className="font-semibold">Последняя фраза не поместилась в лимит 4000 символов.</p>
              <p className="mt-1 text-muted-foreground">Она сохранена ниже и не войдёт в сообщение. Сократите текст в поле и перенесите нужные слова перед отправкой.</p>
              <p className="mt-2 max-h-20 overflow-y-auto select-text">{voiceRemainder}</p>
              <button type="button" disabled={voice.busy} onClick={() => setVoiceRemainder("")} className="mt-2 font-semibold underline underline-offset-4 disabled:opacity-50">Проверено — продолжить с текстом в поле</button>
            </div>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] leading-normal text-muted-foreground">
          Демо-ответы. Проверьте карточку перед публикацией.
        </p>
      </div>
    </div>
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
