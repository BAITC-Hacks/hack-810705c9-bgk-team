import { NextResponse } from 'next/server';
import { getTaskScore } from '@/features/task-match/api/tasks';
import { apiFailure } from '@/features/task-match/api/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await getTaskScore((await params).id)); }
  catch (error) { return apiFailure(error); }
}
