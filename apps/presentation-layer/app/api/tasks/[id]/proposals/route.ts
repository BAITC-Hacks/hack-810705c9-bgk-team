import { NextResponse } from "next/server";
import { getDemoActor } from "@/shared/api/actor";
import { withApi, readJson } from "@/shared/api/errors";
import { proposalInput } from "@/shared/api/contracts/proposals";
import { submitProposal } from "@/features/submit-proposal";
import { listTaskProposals } from "@/features/decide-proposal";

export const POST = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const body = proposalInput.parse(await readJson(req));
  const proposal = await submitProposal(actor, id, body);
  return NextResponse.json(proposal, { status: 201 });
});

export const GET = withApi(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = await getDemoActor();
  const result = await listTaskProposals(actor, id);
  return NextResponse.json(result);
});
