"use client";

import { createContext, useEffect, useState, type ReactNode } from "react";
import { createTaskDocumentStore } from "./documents";

export const TaskDocumentsContext = createContext<ReturnType<typeof createTaskDocumentStore> | null>(null);

/** Owns private files across role, loading, empty-state and task switches. */
export function TaskDocumentsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createTaskDocumentStore());

  useEffect(() => () => store.dispose(), [store]);

  return <TaskDocumentsContext.Provider value={store}>{children}</TaskDocumentsContext.Provider>;
}
