import { NextResponse } from 'next/server';
import { applyToTask, taskProposals } from '@/features/task-match/api/proposals';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await taskProposals((await params).id)); }
  catch (error) { return apiFailure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await applyToTask((await params).id, await jsonBody(request)), { status: 201 }); }
  catch (error) { return apiFailure(error); }
}
