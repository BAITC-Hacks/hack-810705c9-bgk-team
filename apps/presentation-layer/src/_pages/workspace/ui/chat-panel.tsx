"use client";

import { useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Asterisk,
  Check,
  FilePenLine,
  Lightbulb,
  X,
} from "lucide-react";
import {
  calculateScore,
  readiness,
  suggestQuestions,
  TASK_FIELDS,
  type Message,
  type Role,
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

type Props = {
  role: Role;
  task: Task;
  messages: Message[];
  onSend: (text: string, field?: TaskField) => void;
  onEdit: () => void;
};

export function ChatPanel({ role, task, messages, onSend, onEdit }: Props) {
  const [input, setInput] = useState("");
  const [answerField, setAnswerField] = useState<TaskField | undefined>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const questions = suggestQuestions(task);
  const score = calculateScore(task);
  const field = TASK_FIELDS.find((item) => item.key === answerField);
  function send() {
    if (!input.trim()) return;
    onSend(input.trim(), answerField);
    setInput("");
    setAnswerField(undefined);
    inputRef.current?.focus();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 overflow-hidden">
        <ConversationContent
          scrollClassName="workspace-scroll"
          className="mx-auto w-full max-w-[760px] gap-6 px-6 py-7 lg:px-8"
        >
          <div className="ml-auto max-w-[85%]">
            <p className="mb-2 text-right text-[10px] text-muted-foreground">
              {role === "business" ? "Вы · исходная идея" : task.company}
            </p>
            <div className="rounded-2xl rounded-tr-sm bg-[#f0edf9] px-4 py-3.5 text-[13px] leading-[1.8]">
              {task.description}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/[.035] text-primary">
              <Asterisk className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold">Sana</span>
                <span className="text-[10px] text-muted-foreground">
                  Демо-ассистент
                </span>
              </div>
              {role === "business" ? (
                <>
                  <p className="text-[13px] leading-[1.8]">
                    {score === 100
                      ? "Всё важное уже в карточке. Можно перейти к предложениям команд или уточнить детали задачи."
                      : "Давайте превратим идею в понятную задачу для команды."}
                  </p>
                  {questions.length > 0 && (
                    <>
                      <p className="mt-3 text-[13px] leading-[1.8] text-muted-foreground">
                        {task.status === "draft"
                          ? "Начнём с нескольких уточнений. Выберите вопрос, на который готовы ответить."
                          : "Есть несколько деталей, которые помогут студентам предложить точное решение."}
                      </p>
                      <div className="mt-4 space-y-2">
                        {questions.map((question, index) => (
                          <button
                            type="button"
                            key={question.field}
                            onClick={() => {
                              setAnswerField(question.field);
                              inputRef.current?.focus();
                            }}
                            className={cn(
                              "group flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                              answerField === question.field
                                ? "border-primary/40 bg-primary/5"
                                : "border-transparent bg-muted/70 hover:border-primary/20 hover:bg-primary/[.04]",
                            )}
                          >
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-medium text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="flex-1 text-[12px] leading-[1.7]">
                              {question.question}
                            </span>
                            <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-primary" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-[1.8]">
                    Здесь можно разобраться в задаче, а затем предложить своё
                    решение. Вы сами выбираете, за что браться.
                  </p>
                  <div className="mt-4 space-y-4 text-[13px] leading-[1.8]">
                    <div>
                      <h3 className="mb-1 font-medium">Что нужно сделать</h3>
                      <p className="text-muted-foreground">
                        {task.fields.outcome ||
                          task.fields.need ||
                          "Ожидаемый результат пока не описан. Уточните его в предложении бизнесу."}
                      </p>
                    </div>
                    <div>
                      <h3 className="mb-1 font-medium">
                        На что обратить внимание
                      </h3>
                      <p className="text-muted-foreground">
                        {task.fields.constraints ||
                          "Ограничения пока не указаны — предложите подходящий срок и объём работы."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    Сильный отклик связывает вашу идею с результатом бизнеса.
                    Добавьте план и ссылку на прототип.
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
              {message.role === "assistant" && (
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 text-primary">
                  <Asterisk className="size-5" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[90%] whitespace-pre-wrap text-[13px] leading-[1.8]",
                  message.role === "user"
                    ? "rounded-2xl rounded-tr-sm bg-[#f0edf9] px-4 py-3"
                    : "pt-1",
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          {role === "business" && (
            <div className="rounded-xl border bg-white px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium">
                  Готовность задачи
                </span>
                <span className="ml-auto text-xs font-semibold tabular-nums">
                  {score}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    / 100
                  </span>
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div
                  role="progressbar"
                  aria-label="Готовность задачи"
                  aria-valuenow={score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#efedf4]"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${score}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline"
                >
                  {score === 100 ? "Карточка" : "Что улучшить"}
                  <ArrowUpRight className="size-3" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {readiness(score).label} · Баллы за подтверждённые сведения
              </p>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="К последнему сообщению" />
      </Conversation>
      <div className="mx-auto w-full max-w-[760px] shrink-0 px-5 pt-3 pb-3 lg:px-7">
        {role === "student" && messages.length === 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {["Какие данные доступны?", "Как оценивают результат?"].map(
              (suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => onSend(suggestion)}
                  className="rounded-lg border bg-white px-2.5 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {suggestion}
                </button>
              ),
            )}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="rounded-xl border border-[#dcdae6] bg-white p-3 shadow-[0_2px_10px_#29204403] transition-shadow focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/5"
        >
          {field && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-primary/5 px-2 py-1 text-[10px] text-primary">
              <span>Ответ → {field.label}</span>
              <button
                type="button"
                onClick={() => setAnswerField(undefined)}
                aria-label="Отменить выбор вопроса"
              >
                <X className="size-3" />
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
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={
              field
                ? "Напишите ответ своими словами…"
                : role === "business"
                  ? "Дополните задачу или задайте вопрос…"
                  : "Что хотите узнать об этой задаче?"
            }
            className="block min-h-12 w-full resize-none border-0 bg-transparent px-1 py-1 text-[12px] leading-relaxed outline-none placeholder:text-[#9b97a8]"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Asterisk className="size-3.5 text-primary" />
              Демо-ассистент
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-[9px] text-muted-foreground/75 xl:inline">
                Shift + Enter — новая строка
              </span>
              <Button
                size="icon"
                type="submit"
                aria-label="Отправить сообщение"
                disabled={!input.trim()}
                className="size-8 rounded-lg"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </form>
        <p className="mt-2 text-center text-[9px] leading-normal text-muted-foreground">
          {role === "business"
            ? "Ответы — демонстрация. Проверьте и подтвердите карточку перед публикацией."
            : "Открытый выбор задач. Отклик не означает автоматическое назначение."}
        </p>
      </div>
    </div>
  );
}

export function TaskDetails({
  task,
  onEdit,
}: {
  task: Task;
  onEdit?: () => void;
}) {
  return (
    <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">О задаче</h2>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <FilePenLine className="size-3.5" />
            Редактировать
          </Button>
        )}
      </div>
      <div className="space-y-6">
        {TASK_FIELDS.map((field) => (
          <section key={field.key}>
            <div className="mb-1.5 flex items-center gap-2">
              <h3 className="text-[11px] font-medium text-muted-foreground">
                {field.label}
              </h3>
              {task.confirmedFields.includes(field.key) &&
                task.fields[field.key].trim() && (
                  <Check
                    className="size-3 text-emerald-600"
                    aria-label="Подтверждено бизнесом"
                  />
                )}
            </div>
            <p
              className={cn(
                "whitespace-pre-wrap text-[13px] leading-[1.8]",
                !task.fields[field.key] && "text-muted-foreground/75",
              )}
            >
              {task.fields[field.key] || "Пока не указано"}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
