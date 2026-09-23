import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi } from "@/shared/api/errors";
import { getTeamProgress } from "@/features/stage-progress";

export const GET = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  // ADR-008: портфолио и баллы команды читаются любой ролью.
  await getDemoActor();
  const result = await getTeamProgress(id);
  return NextResponse.json(result);
});
