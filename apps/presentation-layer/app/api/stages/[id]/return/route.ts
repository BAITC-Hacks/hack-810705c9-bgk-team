import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi, readJson } from "@/shared/api/errors";
import { stageReturnInput } from "@/shared/api/contracts/proposals";
import { returnStage } from "@/features/stage-progress";

export const POST = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const body = stageReturnInput.parse(await readJson(req));
  const stage = await returnStage(actor, id, body);
  return NextResponse.json(stage);
});
