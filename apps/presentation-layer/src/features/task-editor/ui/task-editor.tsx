"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChevronDown, CircleQuestion } from "@gravity-ui/icons";
import {
  TASK_FIELDS,
  calculateScore,
  readiness,
  scoreBreakdown,
  type Task,
  type TaskField,
} from "@/entities/workspace";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

type TaskEditorProps = {
  task: Task;
  savedTask?: Task;
  draftCache?: Map<string, TaskEditorDraft>;
  onSave: (task: Task, verified: boolean) => void;
  onCancel?: () => void;
};

export type TaskEditorDraft = {
  source: Task;
  draft: Task;
  verified: boolean;
};

type EditorErrors = { title?: string; need?: string; confirmation?: string };
type ScoreLine = { node: string; points: number; max: number; reason: string };

const NODE_LABELS: Record<string, string> = {
  "context.current": "Текущий процесс", "context.size": "Масштаб проблемы", "context.change": "Что изменится",
  "data.what": "Данные и материалы", "data.volume": "Объём данных", "data.sample": "Пример данных",
  "result.artifact": "Результат", "result.acceptance": "Формат сдачи", "criteria.items": "Критерии приёмки",
  "constraints.deadline": "Срок", "constraints.stack": "Стек и роли", "constraints.other": "Другие ограничения",
  "users.role": "Пользователи", "users.scale": "Количество пользователей",
  "link.contact": "Контакт", "link.cadence": "Консультации", "link.response": "Ответ на отклик",
};

function nonemptyFields(task: Task): TaskField[] {
  return TASK_FIELDS.filter((field) => task.fields[field.key].trim()).map(
    (field) => field.key,
  );
}

function isFullyConfirmed(task: Task): boolean {
  const filled = nonemptyFields(task);
  return (
    filled.length > 0 &&
    filled.every((key) => task.confirmedFields.includes(key))
  );
}

// Assistant answers can arrive while this form is open. Keep local edits and
// accept incoming values only where the user has not changed the previous value.
function mergeTask(previous: Task, draft: Task, incoming: Task): Task {
  if (incoming.id !== previous.id) return incoming;
  return {
    ...incoming,
    title: draft.title === previous.title ? incoming.title : draft.title,
    company:
      draft.company === previous.company ? incoming.company : draft.company,
    industry:
      draft.industry === previous.industry ? incoming.industry : draft.industry,
    fields: Object.fromEntries(
      TASK_FIELDS.map(({ key }) => [
        key,
        draft.fields[key] === previous.fields[key]
          ? incoming.fields[key]
          : draft.fields[key],
      ]),
    ) as Record<TaskField, string>,
  };
}

function sameText(first: Task, second: Task): boolean {
  return (
    first.title === second.title &&
    first.company === second.company &&
    first.industry === second.industry &&
    TASK_FIELDS.every(({ key }) => first.fields[key] === second.fields[key])
  );
}

export function TaskEditor({
  task,
  savedTask = task,
  draftCache,
  onSave,
  onCancel,
}: TaskEditorProps) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const needRef = useRef<HTMLTextAreaElement>(null);
  const confirmationRef = useRef<HTMLButtonElement>(null);
  const [editor, setEditor] = useState<TaskEditorDraft>(
    () =>
      draftCache?.get(task.id) ?? {
        source: task,
        draft: task,
        verified: isFullyConfirmed(task),
      },
  );
  const [errors, setErrors] = useState<EditorErrors>({});
  const [serverScoreLines, setServerScoreLines] = useState<ScoreLine[] | null>(null);
  useEffect(() => {
    if (savedTask.score === undefined) return;
    let active = true;
    fetch(`/api/tasks/${savedTask.id}/score`)
      .then((response) => response.ok ? response.json() as Promise<{ lines: ScoreLine[] }> : null)
      .then((result) => { if (active && result) setServerScoreLines(result.lines); })
      .catch(() => { if (active) setServerScoreLines(null); });
    return () => { active = false; };
  }, [savedTask.id, savedTask.score]);

  useEffect(() => {
    draftCache?.set(editor.source.id, editor);
  }, [draftCache, editor]);

  if (editor.source !== task) {
    const draft = mergeTask(editor.source, editor.draft, task);
    setEditor({
      source: task,
      draft,
      verified: sameText(draft, task) && isFullyConfirmed(task),
    });
  }

  const { draft, verified } = editor;
  const candidate: Task = {
    ...draft,
    confirmedFields: verified
      ? nonemptyFields(draft)
      : task.confirmedFields.filter(
          (key) =>
            draft.fields[key].trim() && draft.fields[key] === task.fields[key],
        ),
  };
  const savedScore = calculateScore(savedTask);
  const previewScore = calculateScore(candidate);
  const savedReadiness = readiness(savedScore);
  const isPublished = task.status === "published";
  const changed = !sameText(draft, savedTask) || previewScore !== savedScore;
  const breakdown = scoreBreakdown(savedTask);
  const previewBreakdown = scoreBreakdown(candidate);

  function updateDetails(key: "title" | "company" | "industry", value: string) {
    setEditor((current) => ({
      ...current,
      draft: { ...current.draft, [key]: value },
      verified: false,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      confirmation: undefined,
    }));
  }

  function updateField(key: TaskField, value: string) {
    setEditor((current) => ({
      ...current,
      draft: {
        ...current.draft,
        fields: { ...current.draft.fields, [key]: value },
      },
      verified: false,
    }));
    setErrors((current) => ({
      ...current,
      need: key === "need" || key === "context" ? undefined : current.need,
      confirmation: undefined,
    }));
  }

  function save(publish: boolean) {
    const nextErrors: EditorErrors = {};
    if (!draft.title.trim()) nextErrors.title = "Добавьте название задачи.";
    if (!draft.fields.need.trim() && !draft.fields.context.trim()) {
      nextErrors.need = "Опишите хотя бы проблему или контекст бизнеса.";
    }
    if ((publish || isPublished) && !verified) {
      nextErrors.confirmation = isPublished
        ? "Перед сохранением опубликованной карточки подтвердите, что вы проверили текст."
        : "Перед публикацией подтвердите, что вы проверили текст.";
    }
    setErrors(nextErrors);
    if (nextErrors.title) {
      titleRef.current?.focus();
      return;
    }
    if (nextErrors.need) {
      needRef.current?.focus();
      return;
    }
    if (nextErrors.confirmation) {
      confirmationRef.current?.focus();
      return;
    }
    const nextTask: Task = {
      ...candidate,
      title: draft.title.trim(),
      company: draft.company.trim(),
      industry: draft.industry.trim(),
      fields: Object.fromEntries(
        TASK_FIELDS.map(({ key }) => [key, draft.fields[key].trim()]),
      ) as Record<TaskField, string>,
      status: publish ? "published" : draft.status,
    };
    setEditor((current) => ({
      ...current,
      draft: nextTask,
      verified: isFullyConfirmed(nextTask),
    }));
    onSave(nextTask, verified);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(false);
  }

  return (
    <form
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-card"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Редактор карточки задачи"
    >
      <div className="space-y-7 px-5 py-5 sm:px-7">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Карточка задачи
            </h2>
            <span className="text-xs font-medium text-muted-foreground">
              {changed ? "Есть изменения" : "Сохранено"}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Заполните то, что знаете. Пропуски не мешают публикации.
          </p>
        </div>

        <section
          className="border-y py-4"
          aria-label="Готовность задачи"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-foreground">
                Сохранённая готовность
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Как считается готовность"
                      className="rounded-full p-1 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <CircleQuestion className="size-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-xs leading-relaxed">
                    Баллы начисляются только за заполненные и подтверждённые
                    вами поля. Оценка не ограничивает публикацию.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="shrink-0 text-sm tabular-nums text-muted-foreground">
              <strong className="text-2xl font-bold tracking-tight text-primary">
                {savedScore}
              </strong>{" "}
              / 100
            </div>
          </div>
          <Progress
            value={savedScore}
            aria-label={`Сохранённая готовность: ${savedScore} из 100`}
            className="mt-3 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-primary"
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {savedReadiness.label}
            </span>
            {changed && savedTask.score === undefined ? (
              <span className="text-muted-foreground">
                {isPublished && !verified ? "Предпросмотр" : "После сохранения"}
                :{" "}
                <strong className="font-semibold text-foreground">
                  {previewScore} / 100
                </strong>
              </span>
            ) : null}
          </div>
          <details className="group mt-4 border-t border-border pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-[13px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Из чего складывается оценка
              <ChevronDown
                className="size-3.5 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="mt-4 space-y-3">
              {savedTask.score !== undefined ? (
                serverScoreLines ? serverScoreLines.map((line) => (
                  <div key={line.node} className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-[#595667]">{NODE_LABELS[line.node] ?? line.node}</span>
                    <span className="shrink-0 tabular-nums text-[#858391]">{line.points} / {line.max}</span>
                  </div>
                )) : <p className="text-xs text-[#858391]">Расшифровка временно недоступна.</p>
              ) : breakdown.map((group, index) => (
                <div key={group.label}>
                  <div className="flex items-center justify-between gap-4 text-[13px]">
                    <span className="text-foreground/80">{group.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {group.earned} / {group.max}
                      {changed &&
                      previewBreakdown[index].earned !== group.earned ? (
                        <span className="ml-2 text-primary">
                          → {previewBreakdown[index].earned}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {group.missing.length ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Не подтверждено:{" "}
                      {group.missing
                        .map((key) =>
                          TASK_FIELDS.find(
                            (field) => field.key === key,
                          )?.label.toLowerCase(),
                        )
                        .join(", ")}
                      .
                    </p>
                  ) : null}
                </div>
              ))}
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                Оценка показывает полноту карточки. Даже с низкой оценкой задачу
                можно опубликовать и уточнить вместе с командой.
              </p>
            </div>
          </details>
        </section>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor={`${id}-title`}
              className="text-sm font-semibold text-foreground"
            >
              Название задачи{" "}
              <span className="text-primary" aria-hidden="true">
                *
              </span>
            </label>
            <Input
              ref={titleRef}
              id={`${id}-title`}
              value={draft.title}
              onChange={(event) => updateDetails("title", event.target.value)}
              placeholder="Какую задачу нужно решить?"
              required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? `${id}-title-error` : undefined}
              className="h-10 border-input text-sm"
            />
            {errors.title ? (
              <p
                id={`${id}-title-error`}
                role="alert"
                className="text-xs text-red-600"
              >
                {errors.title}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor={`${id}-company`}
                className="text-sm font-semibold text-foreground"
              >
                Компания
              </label>
              <Input
                id={`${id}-company`}
                value={draft.company}
                onChange={(event) =>
                  updateDetails("company", event.target.value)
                }
                placeholder="Название компании"
                className="h-10 border-input text-sm"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor={`${id}-industry`}
                className="text-sm font-semibold text-foreground"
              >
                Отрасль
              </label>
              <Input
                id={`${id}-industry`}
                value={draft.industry}
                onChange={(event) =>
                  updateDetails("industry", event.target.value)
                }
                placeholder="Например, ритейл"
                className="h-10 border-input text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-5 border-t border-border pt-5">
          {TASK_FIELDS.map((field, index) => {
            const filled = Boolean(draft.fields[field.key].trim());
            const confirmed =
              filled && candidate.confirmedFields.includes(field.key);
            const invalid =
              Boolean(errors.need) &&
              (field.key === "need" || field.key === "context");
            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`${id}-${field.key}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    <span
                      className="mr-2.5 text-xs font-medium tabular-nums text-muted-foreground"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {field.label}
                  </label>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium tabular-nums",
                      confirmed ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {confirmed ? field.weight : 0} / {field.weight}
                  </span>
                </div>
                <Textarea
                  id={`${id}-${field.key}`}
                  ref={field.key === "need" ? needRef : undefined}
                  value={draft.fields[field.key]}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                  placeholder={field.placeholder}
                  rows={field.key === "need" || field.key === "context" ? 3 : 2}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${id}-need-error` : undefined}
                  className="min-h-20 resize-y border-input text-sm leading-relaxed placeholder:text-muted-foreground"
                />
                {field.key === "need" && errors.need ? (
                  <p
                    id={`${id}-need-error`}
                    role="alert"
                    className="text-xs text-red-600"
                  >
                    {errors.need}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-3 border-t pt-5">
          <Checkbox
            ref={confirmationRef}
            id={`${id}-verified`}
            checked={verified}
            onCheckedChange={(checked) => {
              setEditor((current) => ({
                ...current,
                verified: checked === true,
              }));
              setErrors((current) => ({ ...current, confirmation: undefined }));
            }}
            aria-invalid={Boolean(errors.confirmation)}
            aria-describedby={`${id}-confirmation-hint${errors.confirmation ? ` ${id}-confirmation-error` : ""}`}
            className="mt-0.5 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <div>
            <label
              htmlFor={`${id}-verified`}
              className="cursor-pointer text-sm font-semibold leading-relaxed text-foreground"
            >
              Я проверил(а) текст карточки и подтверждаю заполненные поля
            </label>
            <p
              id={`${id}-confirmation-hint`}
              className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
            >
              {verified
                ? "Подтверждённые поля будут учтены в оценке после сохранения."
                : isPublished
                  ? "Проверьте текст перед сохранением. Изменения опубликованной карточки станут видны командам только после подтверждения."
                  : "Изменённые поля получат баллы после вашей проверки. Ранее подтверждённые поля сохраняют оценку."}
            </p>
            {errors.confirmation ? (
              <p
                id={`${id}-confirmation-error`}
                role="alert"
                className="mt-2 text-xs text-red-600"
              >
                {errors.confirmation}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 z-10 mt-auto flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur-sm sm:px-7">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="mr-auto h-10 text-[13px] font-semibold text-muted-foreground"
          >
            Отмена
          </Button>
        ) : null}
        {isPublished ? (
          <Button
            type="submit"
            className="h-10 bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Подтвердить изменения
          </Button>
        ) : (
          <>
            <Button
              type="submit"
              variant="outline"
              className="h-10 border-input px-4 text-[13px] font-semibold text-foreground"
            >
              Сохранить карточку
            </Button>
            <Button
              type="button"
              onClick={() => save(true)}
              className="h-10 bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Подтвердить и опубликовать
            </Button>
          </>
        )}
      </footer>
    </form>
  );
}
