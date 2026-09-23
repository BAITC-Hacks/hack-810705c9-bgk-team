import { NextResponse } from 'next/server';
import { updateTask } from '@/features/task-match/api/tasks';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await updateTask((await params).id, await jsonBody(request))); }
  catch (error) { return apiFailure(error); }
}
