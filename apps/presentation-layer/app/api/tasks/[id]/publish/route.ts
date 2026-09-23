import { NextResponse } from 'next/server';
import { publishTask } from '@/features/task-match/api/tasks';
import { apiFailure } from '@/features/task-match/api/http';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await publishTask((await params).id)); }
  catch (error) { return apiFailure(error); }
}
