import {
  calculateScore,
  readiness,
  scoreBreakdown,
  TASK_FIELDS,
  type Proposal,
  type Task,
  type Team,
} from "@/entities/workspace";
import { analyzeTaskLocally } from "./local-ai-analysis";

export const CHAT_SKILLS = [
  {
    id: "clarify",
    label: "Уточнить задачу",
    description: "Найти пробелы и подготовить вопросы",
    aliases: ["brief", "clarify", "вопросы", "бриф"],
  },
  {
    id: "readiness",
    label: "Проверить готовность",
    description: "Разобрать баллы и следующий шаг",
    aliases: ["score", "readiness", "рейтинг", "баллы"],
  },
  {
    id: "success",
    label: "Критерии успеха",
    description: "Сформулировать, как принять результат",
    aliases: ["success", "criteria", "метрики", "результат"],
  },
  {
    id: "compare",
    label: "Сравнить отклики",
    description: "Сопоставить идеи, планы и сроки команд",
    aliases: ["compare", "teams", "команды", "предложения"],
  },
] as const;

export type ChatSkillId = (typeof CHAT_SKILLS)[number]["id"];

export type MentionRange = { start: number; end: number; query: string };

/** Only a standalone @ token is a command; addresses and prose remain literal. */
export function getMentionRange(
  value: string,
  caret: number,
): MentionRange | null {
  const beforeCaret = value.slice(0, caret);
  const match = beforeCaret.match(/(?:^|\s)@([a-zа-яёәғқңөұүһі0-9_-]*)$/iu);
  if (!match) return null;
  const query = match[1];
  const trailingToken =
    value.slice(caret).match(/^[a-zа-яёәғқңөұүһі0-9_-]*/iu)?.[0] ?? "";
  return {
    start: caret - query.length - 1,
    end: caret + trailingToken.length,
    query,
  };
}

export function removeMention(value: string, range: MentionRange): string {
  return value.slice(0, range.start) + value.slice(range.end);
}

/** Deterministic demo helpers read existing facts; they never edit or confirm a task. */
export function runChatSkill(
  task: Task,
  proposals: Proposal[],
  teams: Team[],
  skill: ChatSkillId,
  instruction: string,
): string {
  const request = instruction.trim()
    ? `Ваше уточнение: «${instruction.trim()}»\n\n`
    : "";

  switch (skill) {
    case "clarify": {
      const { questions, pendingConfirmation } = analyzeTaskLocally(task).output;
      const pending = TASK_FIELDS.filter(({ key }) => pendingConfirmation.includes(key));
      return (
        request +
        (questions.length
          ? [
              `Чтобы уточнить задачу «${task.title}», разберём следующие пункты:`,
              "",
              ...questions.map(
                ({ question }, index) => `${index + 1}. ${question}`,
              ),
              ...(pending.length
                ? [
                    "",
                    `Уже заполнены, но ещё не подтверждены: ${pending.map(({ label }) => label.toLocaleLowerCase("ru")).join(", ")}. Проверьте их в карточке.`,
                  ]
                : []),
              "",
              "Выберите вопрос над перепиской, чтобы записать ответ в соответствующее поле. Затем проверьте и подтвердите карточку.",
            ].join("\n")
          : pending.length
            ? `Все ответы уже внесены. Нужно проверить и подтвердить: ${pending.map(({ label }) => label.toLocaleLowerCase("ru")).join(", ")}. Откройте карточку — повторно отвечать на эти вопросы не нужно. До подтверждения эти поля не добавляют баллы.`
            : task.status === "draft"
              ? "Все поля карточки заполнены и подтверждены. Откройте карточку и опубликуйте задачу, чтобы студенты могли откликнуться."
              : "Все поля карточки заполнены и подтверждены. Можно открыть отклики и сравнить предложения команд. Если условия изменились, сначала отредактируйте карточку.")
      );
    }
    case "readiness": {
      const score = calculateScore(task);
      const missing = TASK_FIELDS.filter(
        ({ key }) =>
          !task.fields[key].trim() || !task.confirmedFields.includes(key),
      ).sort((a, b) => b.weight - a.weight);
      return (
        request +
        [
          `Готовность: ${score} / 100 · ${readiness(score).label}`,
          "",
          ...scoreBreakdown(task).map(
            ({ label, earned, max }) => `${label}: ${earned} / ${max}`,
          ),
          "",
          missing.length
            ? `Следующий шаг: ${missing[0].label.toLocaleLowerCase("ru")}. ${task.fields[missing[0].key].trim() ? "Текст уже есть — проверьте и подтвердите его в карточке." : missing[0].question} Это добавит ${missing[0].weight} баллов после подтверждения.`
            : "Карточка полностью готова. Все 100 баллов начислены за подтверждённые сведения.",
          "Баллы пересчитываются после подтверждения; низкий рейтинг не закрывает задачу для студентов.",
        ].join("\n")
      );
    }
    case "success":
      return (
        request +
        [
          task.fields.outcome.trim()
            ? `Ожидаемый результат из карточки: «${task.fields.outcome.trim()}»`
            : "Ожидаемый результат пока не указан. Сначала определите, что именно команда должна передать.",
          "",
          task.fields.success.trim()
            ? `Текущий критерий: «${task.fields.success.trim()}»${task.confirmedFields.includes("success") ? "" : " — ещё не подтверждён."}`
            : "Критерий успеха пока не заполнен.",
          "",
          "Проверьте три вещи:",
          "1. Какой показатель или проверяемый сценарий оцениваем?",
          "2. С чем сравниваем результат и какое значение примем за успех?",
          "3. Кто, когда и на каких данных проверит результат?",
          "",
          "Шаблон: «К [сроку] команда покажет [результат]. [Ответственный] проверит [показатель] на [данных]; условие приёмки — [значение или сценарий]». Значения в скобках нужно указать вам.",
          "Откройте карточку, внесите согласованную формулировку и подтвердите её.",
        ].join("\n")
      );
    case "compare": {
      const matching = proposals.filter(({ taskId }) => taskId === task.id);
      if (!matching.length)
        return (
          request +
          "У этой задачи пока нет откликов. После публикации студенты смогут предложить идею, план и срок. Когда появятся предложения, здесь можно будет их сравнить."
        );
      const statuses = {
        pending: "на рассмотрении",
        selected: "выбрана бизнесом",
        rejected: "отклонена бизнесом",
      };
      return (
        request +
        [
          `Отклики на задачу «${task.title}»: ${matching.length}.`,
          "",
          ...matching
            .map((proposal, index) => {
              const team = teams.find(({ id }) => id === proposal.teamId);
              return [
                `${index + 1}. ${team?.name ?? "Команда"} · ${statuses[proposal.status]}`,
                `Идея: ${proposal.idea || "не указана"}`,
                `План: ${proposal.plan || "не указан"}`,
                `Срок: ${proposal.timeline || "не указан"}`,
                ...(team?.skills.length
                  ? [`Навыки: ${team.skills.join(", ")}`]
                  : []),
              ].join("\n");
            })
            .flatMap((summary) => [summary, ""]),
          "Сопоставьте объём работ с ожидаемым результатом, а сроки — с ограничениями задачи. Откройте панель откликов, чтобы изучить прототипы и принять решение. Можно выбрать несколько команд или ни одной; выбор остаётся за вами.",
        ].join("\n")
      );
    }
  }
}
