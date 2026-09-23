import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi } from "@/shared/api/errors";
import { listProposalStages } from "@/features/stage-progress";

export const GET = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const result = await listProposalStages(actor, id);
  return NextResponse.json(result);
});
