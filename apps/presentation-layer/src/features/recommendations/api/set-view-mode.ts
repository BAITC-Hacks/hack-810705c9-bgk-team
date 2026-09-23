"use server";

import { cookies } from "next/headers";
import { VIEW_COOKIE, viewModeSchema, type ViewMode } from "@/shared/api/contracts/task-match";

/** FR-5.11: выбор «Колода / Сетка» хранится в cookie и читается при SSR. */
export async function setViewMode(mode: ViewMode): Promise<void> {
  const parsed = viewModeSchema.safeParse(mode);
  if (!parsed.success) return;
  const store = await cookies();
  store.set(VIEW_COOKIE, parsed.data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
