import { NextResponse } from 'next/server';
import { claimStage } from '@/features/task-match/api/proposals';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await claimStage((await params).id, await jsonBody(request))); }
  catch (error) { return apiFailure(error); }
}
