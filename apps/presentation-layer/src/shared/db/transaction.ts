/**
 * ADR-009 §6: транзакции Drizzle оборачивают только короткую запись.
 * Вызов Mastra выполняется ДО и ВНЕ транзакции (ADR-003 §5): сначала
 * inference, затем короткая запись (ход, поля, AiLog, пересчёт).
 *
 * `runInTransaction` — единственная точка, где use-case открывает
 * транзакцию. Реальная реализация делегирует в `db.transaction` (Drizzle,
 * `nextjs_db`); пока схема ADR-004/005/007 не подключена, используется
 * `inMemoryTransaction`, которая просто выполняет колбэк (in-memory store
 * не нуждается в блокировках single-process demo, но сохраняет то же API
 * и порядок вызовов, поэтому переключение на Drizzle не меняет use-case).
 */

export type Transaction = unknown;

export type TransactionRunner = <T>(
  fn: (tx: Transaction) => Promise<T> | T,
) => Promise<T>;

/**
 * INTEGRATION(ADR-004/005/007): заменить на `db.transaction(fn)` из
 * `src/shared/db/index.ts`, когда таблицы task_field/grill_session/... появятся
 * в схеме. Сигнатура (fn: (tx) => T) совпадает с Drizzle, поэтому замена не
 * требует правок в use-case, только смены импорта.
 */
export const inMemoryTransaction: TransactionRunner = async (fn) => {
  return await fn({});
};
