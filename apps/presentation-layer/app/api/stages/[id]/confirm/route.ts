import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi, readJson } from "@/shared/api/errors";
import { stageConfirmInput } from "@/shared/api/contracts/proposals";
import { confirmStage } from "@/features/stage-progress";

export const POST = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const body = stageConfirmInput.parse(await readJson(req));
  const stage = await confirmStage(actor, id, body);
  return NextResponse.json(stage);
});
