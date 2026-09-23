import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi, readJson } from "@/shared/api/errors";
import { stageClaimInput } from "@/shared/api/contracts/proposals";
import { claimStage } from "@/features/stage-progress";

export const POST = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const body = stageClaimInput.parse(await readJson(req));
  const stage = await claimStage(actor, id, body);
  return NextResponse.json(stage);
});
