import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi, readJson } from "@/shared/api/errors";
import { decisionInput } from "@/shared/api/contracts/proposals";
import { decideProposal } from "@/features/decide-proposal";

export const POST = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const body = decisionInput.parse(await readJson(req));
  const result = await decideProposal(actor, id, body);
  return NextResponse.json(result);
});
