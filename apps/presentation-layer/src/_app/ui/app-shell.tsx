import type { ReactNode } from "react";

import { DemoRoleBar } from "@/features/demo-role-switch";

/** Оболочка приложения: страница и переключатель демо-роли (ADR-008). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DemoRoleBar />
    </>
  );
}
