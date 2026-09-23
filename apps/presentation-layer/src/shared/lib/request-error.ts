export function requestError(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось сохранить изменения. Попробуйте ещё раз.";
}
