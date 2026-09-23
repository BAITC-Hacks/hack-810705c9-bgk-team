"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import { TaskDocumentsContext } from "./task-documents-provider";

/** Selects task files; the page-level provider owns their lifetime across content remounts. */
export function useTaskDocuments(taskId: string) {
  const store = useContext(TaskDocumentsContext);
  if (!store) throw new Error("useTaskDocuments must be used within TaskDocumentsProvider");
  const getSnapshot = useCallback(() => store.getSnapshot(taskId), [store, taskId]);
  const { documents, error } = useSyncExternalStore(store.subscribe, getSnapshot, store.getServerSnapshot);

  const addDocuments = useCallback((files: File[]) => store.add(taskId, files), [store, taskId]);
  const removeDocument = useCallback((id: string) => store.remove(taskId, id), [store, taskId]);
  return { documents, error, addDocuments, removeDocument };
}
