import type { Kickoff, KickoffItem } from "@/shared/db/schema";

export type KickoffField = {
  node: string;
  value: string;
  state: "empty" | "suggested" | "confirmed";
  notApplicable: boolean;
};

export type KickoffCriterion = {
  id: string;
  metric: string;
  threshold: string;
  position: number;
  confirmed: boolean;
};

export type BuildKickoffInput = {
  engagement: "paid" | "practice" | "both";
  compensationNote: string | null;
  fields: KickoffField[];
  criteria: KickoffCriterion[];
  now?: Date;
};

// FR-7.9: стартовый пакет собирается кодом из подтверждённых полей, без LLM.
// Платформа (раздел 4): materials/stack/consultations/deadline/engagement.
function findConfirmedValue(fields: KickoffField[], node: string): string | null {
  const field = fields.find((f) => f.node === node);
  if (!field) return null;
  if (field.state !== "confirmed" || field.notApplicable) return null;
  const value = field.value.trim();
  return value.length > 0 ? value : null;
}

export function buildKickoff(input: BuildKickoffInput): Kickoff {
  const { engagement, compensationNote, fields, criteria, now } = input;
  const items: KickoffItem[] = [];

  const materials = findConfirmedValue(fields, "data.sample");
  if (materials !== null) {
    items.push({ key: "materials", label: "Изучить материалы", value: materials });
  }

  const stack = findConfirmedValue(fields, "constraints.stack");
  if (stack !== null) {
    items.push({ key: "stack", label: "Стек и роли", value: stack });
  }

  const cadence = findConfirmedValue(fields, "link.cadence");
  if (cadence !== null) {
    items.push({ key: "consultations", label: "Первая консультация", value: cadence });
  }

  const deadline = findConfirmedValue(fields, "constraints.deadline");
  if (deadline !== null) {
    items.push({ key: "deadline", label: "Срок", value: deadline });
  }

  if (engagement === "paid" || engagement === "both") {
    items.push({
      key: engagement === "both" ? "engagement_job" : "engagement",
      label: "Подработка: условия оплаты",
      value: compensationNote ?? "условия оплаты не указаны",
    });
  }
  if (engagement === "practice" || engagement === "both") {
    items.push({
      key: engagement === "both" ? "engagement_practice" : "engagement",
      label: "Практика",
      value: "подтверждённые этапы и отзыв бизнеса идут в отчёт о практике",
    });
  }

  const confirmedCriteria = criteria
    .filter((c) => c.confirmed)
    .sort((a, b) => a.position - b.position);
  const firstStage =
    confirmedCriteria.length > 0
      ? {
          criterionId: confirmedCriteria[0].id,
          metric: confirmedCriteria[0].metric,
          threshold: confirmedCriteria[0].threshold,
        }
      : null;

  const contact = findConfirmedValue(fields, "link.contact");

  return {
    items,
    firstStage,
    contact,
    builtAt: (now ?? new Date()).toISOString(),
  };
}
