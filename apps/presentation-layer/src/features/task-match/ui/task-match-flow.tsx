"use client";
import { useCallback, useEffect, useState } from "react";
import type { DemoActor } from "@/shared/lib/demo-actor";
import { GRILL_NODES } from "@/entities/grill/model";
import { fitPercent } from '@/entities/team';
import { LEVEL_LABELS, levelOf } from "@/entities/task/model/level";
import { NODE_META } from "@/entities/task/model/nodes";
import type { readTask } from "@/features/task-card/api/read-task";
import type { stages } from "@/shared/db/schema";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { FileText, Magnifier } from "@gravity-ui/icons";
import { Badge } from "@/shared/components/ui/badge";
import { DEMO_TEAMS } from "@/shared/config/demo-actors";
import { cn } from "@/shared/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик", published: "Опубликована", in_work: "В работе", closed: "Закрыта",
  submitted: "На рассмотрении", on_hold: "Отложен", accepted: "Команда выбрана", rejected: "Отклонён",
  open: "К выполнению", claimed: "На проверке", confirmed: "Подтверждено", returned: "На доработке",
  suggested: "Нужно подтвердить", empty: "Не заполнено",
};
const BLOCK_LABELS: Record<string, string> = {
  draft: "Черновик", context: "Контекст", result: "Результат", criteria: "Критерии успеха",
  data: "Данные", constraints: "Ограничения", users: "Пользователи", link: "Контакт",
};
const panel = "rounded-2xl border bg-card p-5 sm:p-6";

function FieldValue({ value }: { value: unknown }) {
  if (value == null || value === "") return <span className="text-muted-foreground">Не указано</span>;
  if (Array.isArray(value)) return <ul className="space-y-2">{value.map((item, index) => <li key={index}><FieldValue value={item} /></li>)}</ul>;
  if (typeof value === "object") return <dl className="space-y-2">{Object.entries(value).map(([key, item]) => <div key={key}><dt className="text-xs text-muted-foreground">{({ metric: "Показатель", threshold: "Условие успеха", howToCheck: "Как проверим" } as Record<string, string>)[key] ?? key}</dt><dd><FieldValue value={item} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

type Detail = Awaited<ReturnType<typeof readTask>>;
type Stage = typeof stages.$inferSelect;
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "Не удалось выполнить запрос");
  return data as T;
}
export function TaskMatchFlow({
  actor,
  initialTaskId,
}: {
  actor: DemoActor;
  initialTaskId?: string;
}) {
  const [items, setItems] = useState<
    { id: string; title: string; score?: number }[]
  >([]);
  const [id, setId] = useState(initialTaskId ?? "");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageRows, setStages] = useState<Record<string, Stage[]>>({});
  const load = useCallback(async (taskId: string) => {
    const list = await request<{ tasks: typeof items }>("/api/tasks");
    setItems(list.tasks);
    if (!taskId) return;
    const result = await request<Detail>(`/api/tasks/${taskId}`);
    setDetail(result);
    setId(taskId);
    const entries = await Promise.all(
      result.proposals
        .filter((p) => p.status === "accepted")
        .map(async (p) => {
          const result = await request<Stage[]>(
            `/api/proposals/${p.id}/stages`,
          );
          return [p.id, result] as const;
        }),
    );
    setStages(Object.fromEntries(entries));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => load(initialTaskId ?? '')).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [initialTaskId, load]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, body: unknown, method = "POST") {
    await request(path, method, body);
    await load(id);
  }
  const owner =
    actor.role === "business" && detail?.task.businessId === actor.businessId;
  const grill = detail?.grill;
  const score = detail?.task.score ?? 0;
  const level = LEVEL_LABELS[levelOf(score)];
  const fieldStateLabel: Record<string, string> = {
    empty: "Нет ответа", suggested: "На проверке", confirmed: "Подтверждено",
  };
  return (
    <main className="w-full bg-workspace-surface">
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 text-sm sm:px-6 lg:px-8 lg:py-8">
      <header className="border-b pb-6">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Рабочее пространство / задачи</p>
          <h1 className="text-2xl font-semibold tracking-tight">Мэтч задач</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">От первого описания до готовой карточки, откликов и результата.</p>
        </div>
      </header>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {actor.role === "business" && (
        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <span><span className="block text-sm font-semibold">Новая задача</span><span className="mt-0.5 block text-xs text-muted-foreground">Опишите идею, чтобы создать черновик карточки</span></span>
            <span className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground group-open:hidden">+ Создать</span>
            <span className="hidden text-xl leading-none text-muted-foreground group-open:block" aria-hidden="true">−</span>
          </summary>
        <form
          className="space-y-3 border-t px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void act(async () => {
              const r = await request<{ task: { id: string } }>(
                "/api/tasks",
                "POST",
                { description: f.get("description") },
              );
              await load(r.task.id);
            });
          }}
        >
          <label className="text-sm font-medium" htmlFor="draft">Описание задачи бизнеса</label>
          <Textarea
            id="draft"
            name="description"
            minLength={20}
            maxLength={2000}
            required
            placeholder="Расскажите, как всё работает сейчас, что нужно изменить и какой результат ожидаете…"
            className="min-h-28 resize-y bg-background"
          />
          <Button disabled={busy}>Создать черновик</Button>
        </form>
        </details>
      )}
      <div className="grid min-h-0 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border bg-workspace-surface lg:sticky lg:top-5" aria-label="Задачи">
          <div className="border-b px-4 py-4">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">{actor.role === "business" ? "Мои задачи" : "Задачи"}</h2><span className="rounded-md bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{items.length}</span></div>
            <div className="relative mt-3"><Magnifier className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Найти задачу" placeholder="Найти задачу…" value={query} onChange={event => setQuery(event.target.value)} className="h-10 border-transparent bg-muted pl-9 text-sm shadow-none" /></div>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto p-2 lg:max-h-[calc(100dvh-270px)]">
          {items.filter(t => t.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))).map((t) => (
            <button
              type="button"
              disabled={busy}
              key={t.id}
              aria-current={id === t.id ? "true" : undefined}
              className={cn("block w-full rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring", id === t.id ? "bg-workspace-selected text-workspace-selected-foreground" : "hover:bg-card")}
              onClick={() => void act(() => load(t.id))}
            >
              <span className="line-clamp-2 text-sm font-semibold leading-snug">{t.title}</span>
              <span className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>Готовность</span><span className="font-semibold tabular-nums">{t.score ?? 0}/100</span></span>
            </button>
          ))}
          {loading && <p role="status" className="p-4 text-muted-foreground">Загружаем задачи…</p>}
          {!loading && !items.some(t => t.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))) && <p className="p-4 text-sm text-muted-foreground">{query ? "Ничего не найдено. Попробуйте другой запрос." : "Пока нет доступных задач."}</p>}
          </div>
        </aside>
        {!detail && <section className={`${panel} flex min-h-72 flex-col items-center justify-center gap-3 text-center`}><div className="rounded-2xl bg-muted p-4"><FileText className="size-6 text-muted-foreground" /></div><h2 className="text-base font-semibold">{busy ? "Открываем задачу…" : "Выберите задачу"}</h2><p className="max-w-sm text-muted-foreground">Здесь появятся описание, критерии успеха, отклики и этапы работы.</p></section>}
        {detail && (
          <section className="min-w-0 space-y-4">
            <div className="rounded-2xl border bg-card px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-muted px-2.5 py-1 font-medium">{STATUS_LABELS[detail.task.status] ?? detail.task.status}</span><span className="rounded-full border px-2.5 py-1 text-muted-foreground">{level}</span></div>
                  <h2 className="max-w-3xl text-xl font-bold leading-tight tracking-tight sm:text-2xl">{detail.task.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Карточка задачи и следующий шаг</p>
                </div>
                <div className="min-w-32 rounded-xl bg-workspace-surface px-4 py-3 text-right"><span className="block text-[11px] font-medium text-muted-foreground">Готовность</span><span className="text-3xl font-bold tabular-nums">{score}<span className="text-base font-normal text-muted-foreground">/100</span></span></div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Готовность задачи" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>
            </div>
            {owner && grill && (
              <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span><div><h3 className="font-bold">Следующий шаг</h3><p className="text-xs text-muted-foreground">Уточняем задачу по одному вопросу</p></div></div>
                {grill.next?.kind === "checkpoint" ? (
                  <>
                    <p className="text-sm leading-relaxed">
                      Проверьте сведения блока «{BLOCK_LABELS[grill.next.block!] ?? grill.next.block}» и
                      подтвердите их.
                    </p>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          mutate(`/api/tasks/${id}/grill/checkpoint`, {
                            block:
                              grill.next?.kind === "checkpoint"
                                ? grill.next.block
                                : "draft",
                            action: "confirm",
                            sessionVersion: grill.session.version,
                          }),
                        )
                      }
                    >
                      Верно, подтверждаю
                    </Button>
                  </>
                ) : grill.next?.kind === "question" ? (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const answer = new FormData(form).get("answer");
                      void act(async () => {
                        await mutate(`/api/tasks/${id}/grill/turn`, {
                          answer,
                          sessionVersion: grill.session.version,
                        });
                        form.reset();
                      });
                    }}
                  >
                    <p className="text-base font-medium leading-relaxed">{grill.next.question}</p>
                    <Textarea name="answer" required className="min-h-24" placeholder="Ваш ответ…" />
                    <Button disabled={busy}>Ответить</Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">Можно отредактировать и подтвердить поля ниже.</p>
                )}
                {detail.task.status === "draft" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(() => mutate(`/api/tasks/${id}/publish`, {}))
                    }
                  >
                    Завершить прожарку и опубликовать
                  </Button>
                )}
              </section>
            )}
            {detail.score && (
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Рейтинг и история</h3><p className="mt-1 text-xs text-muted-foreground">Баллы за подтверждённые сведения</p></div><span className="rounded-lg bg-workspace-surface px-3 py-2 text-sm font-semibold tabular-nums">Место: {detail.score.place}</span></div>
                {detail.score.lastChange && <p className="mt-4 text-sm">Изменение: <span className="font-semibold tabular-nums">{detail.score.lastChange.before} → {detail.score.lastChange.after}</span></p>}
                <details className="mt-4 border-t pt-4">
                  <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">Расшифровка по полям</summary>
                  <div className="mt-3 divide-y">
                  {detail.score.lines.map((l) => (
                    <div key={l.node} className="flex items-start justify-between gap-4 py-2 text-xs"><span><span className="font-medium">{NODE_META[l.node]?.label ?? l.node}</span><span className="mt-0.5 block text-muted-foreground">{l.reason}</span></span><span className="shrink-0 font-semibold tabular-nums">{l.points}/{l.max}</span></div>
                  ))}
                  </div>
                </details>
              </section>
            )}
            <details className="rounded-2xl border bg-card p-5 sm:p-6" open>
              <summary className="cursor-pointer font-bold focus-visible:outline-2 focus-visible:outline-ring">Поля карточки <span className="ml-2 text-xs font-normal text-muted-foreground">{owner ? "Откройте поле, чтобы проверить или исправить" : "Подтверждённые сведения"}</span></summary>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {GRILL_NODES.filter((n) => n.node !== "constraints.stack").map(
                  ({ node }) => {
                    const field = detail.task.fields.find(
                      (f) => f.node === node,
                    );
                    const isCriteria = node === "criteria.items";
                    const value = isCriteria
                      ? JSON.stringify(
                          detail.criteria.map((c) => ({
                            metric: c.metric,
                            threshold: c.threshold,
                            howToCheck: c.howToCheck,
                          })),
                          null,
                          2,
                        )
                      : (field?.value ?? "");
                    if (!owner)
                      return value && value !== "[]" ? (
                        <div key={node} className={cn("min-w-0 rounded-xl border bg-workspace-surface p-4 text-sm", isCriteria && "sm:col-span-2")}>
                          <h3 className="mb-2 text-xs font-medium text-muted-foreground">{NODE_META[node].label}</h3>
                          {isCriteria ? <div className="grid gap-3">{detail.criteria.map((criterion, index) => <article key={criterion.id} className="rounded-lg border bg-card p-4"><div className="mb-3 flex items-start gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">{index + 1}</span><h4 className="font-medium">{criterion.metric}</h4></div><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Условие успеха</dt><dd className="mt-1">{criterion.threshold}</dd></div><div><dt className="text-xs text-muted-foreground">Как проверим</dt><dd className="mt-1">{criterion.howToCheck}</dd></div></dl></article>)}</div> : <FieldValue value={value} />}
                        </div>
                      ) : null;
                    return (
                      <details key={`${id}:${node}:${grill?.session.version}`} className="group min-w-0 rounded-lg border bg-workspace-surface sm:col-span-2">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><span className="min-w-0 text-sm font-semibold">{NODE_META[node].label}</span><span className="shrink-0 rounded-full bg-card px-2 py-1 text-[11px] text-muted-foreground">{fieldStateLabel[field?.state ?? (isCriteria ? detail.criteria[0]?.state ?? "empty" : "empty")] ?? "Нет ответа"}</span></summary>
                      <form
                        className="space-y-3 border-t bg-card px-4 py-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = new FormData(e.currentTarget);
                          const value = isCriteria
                            ? [0, 1, 2]
                                .map((i) => ({
                                  metric: String(form.get(`metric${i}`) ?? ""),
                                  threshold: String(
                                    form.get(`threshold${i}`) ?? "",
                                  ),
                                  howToCheck: String(
                                    form.get(`check${i}`) ?? "",
                                  ),
                                }))
                                .filter((c) => c.metric.trim())
                            : form.get("value");
                          void act(() =>
                            mutate(
                              `/api/tasks/${id}/fields/${node}`,
                              {
                                action: "edit",
                                value,
                                sessionVersion: grill?.session.version,
                              },
                              "PATCH",
                            ),
                          );
                        }}
                      >
                        <label className="text-xs font-medium text-muted-foreground" htmlFor={isCriteria ? undefined : node}>Ответ для поля «{NODE_META[node].label}»</label>
                        {isCriteria ? (
                          <div className="space-y-3">
                            {[0, 1, 2].map((i) => (
                              <fieldset key={i} className="space-y-2 rounded-lg border p-3">
                                <legend className="px-1 text-xs font-semibold">Критерий {i + 1}</legend>
                                <Input
                                  name={`metric${i}`}
                                  aria-label={`Показатель ${i + 1}`}
                                  placeholder="Что измеряем"
                                  defaultValue={
                                    detail.criteria[i]?.metric ?? ""
                                  }
                                />
                                <Input
                                  name={`threshold${i}`}
                                  aria-label={`Порог ${i + 1}`}
                                  placeholder="Условие успеха"
                                  defaultValue={
                                    detail.criteria[i]?.threshold ?? ""
                                  }
                                />
                                <Input
                                  name={`check${i}`}
                                  aria-label={`Проверка ${i + 1}`}
                                  placeholder="Как проверим"
                                  defaultValue={
                                    detail.criteria[i]?.howToCheck ?? ""
                                  }
                                />
                              </fieldset>
                            ))}
                          </div>
                        ) : (
                          <Textarea
                            id={node}
                            name="value"
                            defaultValue={value}
                            required
                            className="min-h-24 bg-background"
                          />
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" disabled={busy}>
                            Сохранить правку
                          </Button>
                          <Button
                            type="button"
                            disabled={
                              busy || (!field && !detail.criteria.length)
                            }
                            onClick={() =>
                              void act(() =>
                                mutate(
                                  `/api/tasks/${id}/fields/${node}`,
                                  {
                                    action: "confirm",
                                    sessionVersion: grill?.session.version,
                                  },
                                  "PATCH",
                                ),
                              )
                            }
                          >
                            Подтвердить
                          </Button>
                        </div>
                      </form>
                      </details>
                    );
                  },
                )}
              </div>
            </details>
            {owner && (
              <form
                className="space-y-3 rounded-2xl border bg-card p-5 sm:p-6"
                key={`${id}:tags`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(() =>
                    mutate(
                      `/api/tasks/${id}`,
                      {
                        neededRoles: String(f.get("roles"))
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        neededSkills: String(f.get("skills"))
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        tagsState: "confirmed",
                        engagement: f.get("engagement"),
                      },
                      "PATCH",
                    ),
                  );
                }}
              >
                <h3 className="font-bold">Роли, навыки и формат</h3>
                <Input
                  name="roles"
                  aria-label="Роли через запятую"
                  defaultValue={detail.task.neededRoles.join(", ")}
                />
                <Input
                  name="skills"
                  aria-label="Навыки через запятую"
                  defaultValue={detail.task.neededSkills.join(", ")}
                />
                <select
                  name="engagement"
                  defaultValue={detail.task.engagement}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="practice">Практика</option>
                  <option value="paid">Подработка</option>
                  <option value="both">Оба формата</option>
                </select>
                <Button disabled={busy}>Подтвердить роли и навыки</Button>
              </form>
            )}
            {actor.role === "team" &&
              ["published", "in_work"].includes(detail.task.status) &&
              !detail.proposals.some((p) => p.status !== "rejected") && (
                <form
                  className="space-y-3 rounded-2xl border bg-card p-5 sm:p-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act(() =>
                      mutate(`/api/tasks/${id}/proposals`, {
                        solution: f.get("solution"),
                        plan: f.get("plan"),
                        deadline: f.get("deadline"),
                        teamRoles: String(f.get("roles"))
                          .split(",")
                          .map((s) => s.trim()),
                        repoUrl: f.get("repoUrl"),
                        criteriaAnswers: Object.fromEntries(
                          detail.criteria.map((c) => [c.id, f.get(c.id)]),
                        ),
                      }),
                    );
                  }}
                >
                  <h3 className="font-bold">Отклик команды</h3>
                  <Textarea
                    name="solution"
                    placeholder="Идея решения"
                    required
                  />
                  <Textarea name="plan" placeholder="План работы" required />
                  <Input name="deadline" placeholder="Срок" required />
                  <Input
                    name="roles"
                    placeholder="Роли команды через запятую"
                    required
                  />
                  <Input
                    name="repoUrl"
                    type="url"
                    placeholder="Ссылка на прототип (необязательно)"
                  />
                  {detail.criteria.map((c) => (
                    <label key={c.id} className="block">
                      Как проверим: {c.metric} — {c.threshold}
                      <Input name={c.id} required />
                    </label>
                  ))}
                  <Button disabled={busy}>Отправить отклик</Button>
                </form>
              )}
            {detail.proposals.map((p) => (
              <article key={p.id} className="space-y-3 rounded-2xl border bg-card p-5 sm:p-6">
                <h3 className="font-semibold">
                  {DEMO_TEAMS.find(team => team.id === p.teamId)?.name ?? "Отклик команды"}
                  <span className="mt-2 flex flex-wrap gap-2"><Badge variant="secondary">{STATUS_LABELS[p.status] ?? p.status}</Badge><Badge variant="outline">Совпадение {fitPercent(p.fit)}%</Badge></span>
                </h3>
                <p>{p.solution}</p>
                <p>
                  {p.plan} · {p.deadline}
                </p>
                {owner && ["submitted", "on_hold"].includes(p.status) && (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Команда получит ваш контакт. Выбрать команду?",
                          )
                        )
                          void act(() =>
                            mutate(`/api/proposals/${p.id}/decision`, {
                              action: "accept",
                            }),
                          );
                      }}
                    >
                      Выбрать команду
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          mutate(`/api/proposals/${p.id}/decision`, {
                            action:
                              p.status === "on_hold" ? "submitted" : "on_hold",
                          }),
                        )
                      }
                    >
                      {p.status === "on_hold"
                        ? "Вернуть к рассмотрению"
                        : "Отложить"}
                    </Button>
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const note = new FormData(e.currentTarget).get("note");
                        void act(() =>
                          mutate(`/api/proposals/${p.id}/decision`, {
                            action: "reject",
                            reason: "other",
                            note,
                          }),
                        );
                      }}
                    >
                      <Input
                        name="note"
                        placeholder="Причина отклонения"
                        required
                      />
                      <Button variant="outline" disabled={busy}>
                        Отклонить
                      </Button>
                    </form>
                  </>
                )}
                {p.kickoff && (
                  <section>
                    <h4 className="font-semibold">Стартовый пакет</h4>
                    {p.kickoff.items.map((i) => (
                      <div key={i.key} className="border-b py-3 last:border-0"><p className="mb-1 text-xs text-muted-foreground">{i.label}</p><FieldValue value={i.value} /></div>
                    ))}
                    <p>Контакт: {p.kickoff.contact}</p>
                  </section>
                )}
                {(stageRows[p.id] ?? []).map((s) => (
                  <section key={s.id} className="space-y-2 border-t pt-3">
                    <p>
                      {s.metric}: {s.threshold} <Badge variant="secondary">{STATUS_LABELS[s.status] ?? s.status}</Badge> <span className="text-xs text-muted-foreground">{s.points} баллов</span>
                    </p>
                    <p>{s.howToCheck}</p>
                    {s.businessComment && <p>{s.businessComment}</p>}
                    {actor.role === "team" &&
                      ["open", "returned"].includes(s.status) && (
                        <form
                          className="space-y-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void act(() =>
                              mutate(`/api/stages/${s.id}/claim`, {
                                reportUrl: f.get("url"),
                                comment: f.get("comment"),
                              }),
                            );
                          }}
                        >
                          <Input
                            name="url"
                            type="url"
                            placeholder="Ссылка на результат"
                            required
                          />
                          <Input
                            name="comment"
                            placeholder="Комментарий команды"
                            required
                          />
                          <Button disabled={busy}>Сдать этап</Button>
                        </form>
                      )}
                    {owner && s.status === "claimed" && (
                      <>
                        <a href={s.reportUrl ?? "#"}>Результат команды</a>
                        <p>{s.teamComment}</p>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void act(() =>
                              mutate(`/api/stages/${s.id}/confirm`, {}),
                            )
                          }
                        >
                          Подтвердить · +10 баллов
                        </Button>
                        <form
                          className="flex flex-wrap gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const comment = new FormData(e.currentTarget).get(
                              "comment",
                            );
                            void act(() =>
                              mutate(`/api/stages/${s.id}/return`, { comment }),
                            );
                          }}
                        >
                          <Input
                            name="comment"
                            placeholder="Что нужно исправить"
                            required
                          />
                          <Button variant="outline" disabled={busy}>
                            Вернуть
                          </Button>
                        </form>
                      </>
                    )}
                  </section>
                ))}
              </article>
            ))}
            {owner && detail.task.status === "published" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(() => mutate(`/api/tasks/${id}/close`, {}))
                }
              >
                Закрыть задачу без выбора
              </Button>
            )}
          </section>
        )}
      </div>
      </div>
    </main>
  );
}
