// ADR-008: минимальные структурные типы для фильтров видимости.
//
// ИНТЕГРАЦИЯ: настоящие Task/Field/Proposal/Stage задают ADR-004/005/007
// (Drizzle-схема, поля по разделу 10 платформы). Здесь только поля, от которых
// зависит доступ; строки из БД подходят структурно, лишние поля сохраняются.

export type TaskStatus = "draft" | "published" | "in_work" | "closed";
export type FieldState = "empty" | "suggested" | "confirmed";

export type AccessField = {
  node: string;
  value: string | null;
  state: FieldState;
  notApplicable?: boolean;
  /** Внутренние данные бизнеса (FR-2.5): исполнителю не показываются. */
  source?: string | null;
  sourceQuote?: string | null;
  sourceTurnId?: string | null;
};

export type AccessTask<F extends AccessField = AccessField> = {
  id: string;
  businessId: string;
  status: TaskStatus;
  fields: F[];
  /** Сырой черновик бизнеса; в виде исполнителя скрыт. */
  draftText?: string | null;
};

export type AccessProposal = { id: string; taskId: string; teamId: string };
export type AccessStage = { id: string; proposalId: string };

/** owner — своя задача бизнеса; executor — вид команды; catalog — чужая задача для бизнеса. */
export type TaskAccess = "owner" | "executor" | "catalog";
