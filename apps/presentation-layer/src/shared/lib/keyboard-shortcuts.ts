/** Allow explicit shortcuts only on the active surface, never behind a modal. */
export function shouldHandleShortcut(
  event: KeyboardEvent,
  scope?: HTMLElement | null,
): boolean {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    (event.altKey && (event.ctrlKey || event.metaKey))
  )
    return false;

  const visible = (element: Element) =>
    element.getAttribute("data-state") !== "closed" &&
    element.getClientRects().length > 0;
  if (
    [...document.querySelectorAll('[role="menu"], [role="listbox"]')].some(
      visible,
    )
  ) {
    return false;
  }
  const dialogs = [
    ...document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
  ].filter(visible);
  const topDialog = dialogs.at(-1);
  return !topDialog || topDialog === scope;
}

export function isTextEditing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest("input, textarea, select, [contenteditable='true']"))
  );
}
