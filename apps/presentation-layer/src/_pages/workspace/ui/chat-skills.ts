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
