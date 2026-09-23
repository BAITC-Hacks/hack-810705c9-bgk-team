import { AppPageFrame } from "./app-page-frame";
import { getDemoActor } from "@/shared/lib/demo-actor.server";
import type { ReactNode } from "react";

import { DemoRoleBar } from "@/features/demo-role-switch/index.server";

/** Оболочка приложения: страница и переключатель демо-роли (ADR-008). */
export async function AppShell({ children }: { children: ReactNode }) {
  const actor = await getDemoActor();
  return (
    <>
      <AppPageFrame teamId={actor.role === "team" ? actor.teamId : undefined}>{children}</AppPageFrame>
      <DemoRoleBar />
    </>
  );
}
