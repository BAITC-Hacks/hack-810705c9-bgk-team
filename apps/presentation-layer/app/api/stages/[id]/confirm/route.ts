import { NextResponse } from 'next/server';
import { confirmStage } from '@/features/task-match/api/proposals';
import { apiFailure } from '@/features/task-match/api/http';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await confirmStage((await params).id)); }
  catch (error) { return apiFailure(error); }
}
