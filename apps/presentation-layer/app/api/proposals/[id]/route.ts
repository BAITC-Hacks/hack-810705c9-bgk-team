import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi, readJson } from "@/shared/api/errors";
import { proposalInput } from "@/shared/api/contracts/proposals";
import { updateProposal } from "@/features/submit-proposal";

export const PATCH = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const body = proposalInput.parse(await readJson(req));
  const proposal = await updateProposal(actor, id, body);
  return NextResponse.json(proposal);
});
