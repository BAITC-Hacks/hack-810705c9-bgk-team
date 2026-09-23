import { NextResponse } from 'next/server';
import { updateTask } from '@/features/task-match/api/tasks';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await updateTask((await params).id, await jsonBody(request))); }
  catch (error) { return apiFailure(error); }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
 try {
  const { requireDemoActor } = await import('@/shared/lib/demo-actor.server');
  const { readTask } = await import('@/features/task-card/api/read-task');
  return NextResponse.json(await readTask(await requireDemoActor(), (await params).id));
 } catch(error) { return apiFailure(error); }
}
