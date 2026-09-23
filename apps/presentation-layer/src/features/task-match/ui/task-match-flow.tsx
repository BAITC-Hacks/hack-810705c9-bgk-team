"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DemoActor } from "@/shared/lib/demo-actor";
import { GRILL_NODES } from "@/entities/grill/model";
import { fitPercent } from '@/entities/team';
import { NODE_META } from "@/entities/task/model/nodes";
import type { readTask } from "@/features/task-card/api/read-task";
import type { stages } from "@/shared/db/schema";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";

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
    void Promise.resolve().then(() => load(initialTaskId ?? '')).catch(e => setError(e.message));
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
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Мэтч задач</h1>
        <nav className="flex gap-4">
          <Link href="/">Рабочее пространство</Link>
          <Link href="/catalog">Каталог</Link>
          {actor.role === "team" && (
            <Link href={`/teams/${actor.teamId}/recommendations`}>
              Рекомендации
            </Link>
          )}
        </nav>
      </header>
      {error && (
        <p role="alert" className="rounded border border-red-400 p-3">
          {error}
        </p>
      )}
      {actor.role === "business" && (
        <form
          className="space-y-2 rounded border p-4"
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
          <label htmlFor="draft">Опишите задачу бизнеса</label>
          <Textarea
            id="draft"
            name="description"
            minLength={20}
            maxLength={2000}
            required
          />
          <Button disabled={busy}>Создать черновик</Button>
        </form>
      )}
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          {items.map((t) => (
            <button
              key={t.id}
              className={`block w-full rounded border p-3 text-left ${id === t.id ? "bg-muted" : ""}`}
              onClick={() => void act(() => load(t.id))}
            >
              {t.title}
              <span className="block text-sm text-muted-foreground">
                Рейтинг: {t.score ?? 0}
              </span>
            </button>
          ))}
        </aside>
        {detail && (
          <section className="min-w-0 space-y-5">
            <h2 className="text-xl font-semibold">{detail.task.title}</h2>
            <p>
              Рейтинг {detail.task.score} · {detail.task.status}
            </p>
            {owner && grill && (
              <section className="space-y-3 rounded border p-4">
                <h3 className="font-semibold">Прожарка</h3>
                {grill.next?.kind === "checkpoint" ? (
                  <>
                    <p>
                      Проверьте сведения блока «{grill.next.block}» и
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
                    className="space-y-2"
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
                    <p>{grill.next.question}</p>
                    <Textarea name="answer" required />
                    <Button disabled={busy}>Ответить</Button>
                  </form>
                ) : (
                  <p>Можно отредактировать и подтвердить поля ниже.</p>
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
              <section className="rounded border p-4">
                <h3 className="font-semibold">Рейтинг и история</h3>
                <p>
                  Место: {detail.score.place}.{" "}
                  {detail.score.lastChange &&
                    `${detail.score.lastChange.before} → ${detail.score.lastChange.after}`}
                </p>
                <details>
                  <summary>Расшифровка</summary>
                  {detail.score.lines.map((l) => (
                    <p key={l.node}>
                      {l.node}: {l.points}/{l.max} — {l.reason}
                    </p>
                  ))}
                </details>
              </section>
            )}
            <details className="rounded border p-4" open>
              <summary className="font-semibold">Поля карточки</summary>
              <div className="mt-3 space-y-4">
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
                        <p key={node}>
                          <strong>{NODE_META[node].label}</strong>: {value}
                        </p>
                      ) : null;
                    return (
                      <form
                        key={`${id}:${node}:${grill?.session.version}`}
                        className="space-y-2"
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
                        <label className="block" htmlFor={node}>
                          {NODE_META[node].label} ·{" "}
                          {field?.state ??
                            (isCriteria ? detail.criteria[0]?.state : "empty")}
                        </label>
                        {isCriteria ? (
                          <div className="space-y-3">
                            {[0, 1, 2].map((i) => (
                              <fieldset key={i} className="space-y-2">
                                <legend>Критерий {i + 1}</legend>
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
                          />
                        )}
                        <div className="flex gap-2">
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
                    );
                  },
                )}
              </div>
            </details>
            {owner && (
              <form
                className="space-y-2 rounded border p-4"
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
                <h3 className="font-semibold">Роли, навыки и формат</h3>
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
                  className="rounded border p-2"
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
                  className="space-y-2 rounded border p-4"
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
                  <h3 className="font-semibold">Отклик команды</h3>
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
              <article key={p.id} className="space-y-3 rounded border p-4">
                <h3 className="font-semibold">
                  Отклик {p.teamId} · {p.status} · {fitPercent(p.fit)}%
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
                      className="flex gap-2"
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
                      <p key={i.key}>
                        {i.label}: {i.value}
                      </p>
                    ))}
                    <p>Контакт: {p.kickoff.contact}</p>
                  </section>
                )}
                {(stageRows[p.id] ?? []).map((s) => (
                  <section key={s.id} className="space-y-2 border-t pt-3">
                    <p>
                      {s.metric}: {s.threshold} · {s.status} · {s.points} баллов
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
                          className="flex gap-2"
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
    </main>
  );
}
