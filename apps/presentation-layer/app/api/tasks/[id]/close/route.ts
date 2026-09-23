import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi } from "@/shared/api/errors";
import { closeTask } from "@/features/close-task";

export const POST = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const result = await closeTask(actor, id);
  return NextResponse.json(result);
});
