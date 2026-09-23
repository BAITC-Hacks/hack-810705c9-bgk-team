import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi } from "@/shared/api/errors";
import { getKickoff } from "@/features/stage-progress";

export const GET = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const result = await getKickoff(actor, id);
  return NextResponse.json(result);
});
