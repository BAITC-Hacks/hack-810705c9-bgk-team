// FR-4.7 «Пока неизвестно»: открытые блоки карточки задачи.
// Предположение для интеграции: источник — `score(card).missing` из ADR-005,
// которого в этой ветке нет. До интеграции возвращаем пустые списки, и плитка
// не показывает блок. Сигнатуру не менять: при интеграции заменить тело на
// загрузку карточек `taskIds` и `score(card).missing`.
export async function openBlocksOf(
  taskIds: string[],
): Promise<Map<string, string[]>> {
  return new Map(taskIds.map((id) => [id, []]));
}
