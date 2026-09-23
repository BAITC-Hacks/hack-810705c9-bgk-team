import { NextResponse } from 'next/server';
import { kickoff } from '@/features/task-match/api/proposals';
import { apiFailure } from '@/features/task-match/api/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await kickoff((await params).id)); }
  catch (error) { return apiFailure(error); }
}
