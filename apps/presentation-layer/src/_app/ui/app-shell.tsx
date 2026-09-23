import Link from "next/link";
import type { ReactNode } from "react";

import { DemoRoleBar } from "@/features/demo-role-switch/index.server";

/** Оболочка приложения: страница и переключатель демо-роли (ADR-008). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="border-b px-4 py-2 text-sm"><Link href="/task-match">Мэтч задач: от черновика до результата</Link></nav>
      {children}
      <DemoRoleBar />
    </>
  );
}
