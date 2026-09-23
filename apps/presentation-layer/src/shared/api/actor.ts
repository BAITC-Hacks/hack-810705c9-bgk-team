import { cookies } from "next/headers";
import { ApiError } from "./errors";

// ИНТЕГРАЦИЯ: ADR-008 владеет этим файлом; здесь минимальная версия.

export type DemoActor = { role: "business"; businessId: string } | { role: "team"; teamId: string };

export async function getDemoActor(): Promise<DemoActor> {
  const jar = await cookies();
  const role = jar.get("tm_role")?.value;
  const actorId = jar.get("tm_actor")?.value;

  if (role === "business" && actorId) {
    return { role: "business", businessId: actorId };
  }
  if (role === "team" && actorId) {
    return { role: "team", teamId: actorId };
  }
  throw new ApiError(403, "forbidden", "Выберите роль и участника в шапке демо");
}
