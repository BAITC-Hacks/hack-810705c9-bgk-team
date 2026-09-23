import { NextResponse } from 'next/server';
import { updateField } from '@/features/task-match/api/tasks';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; node: string }> }) {
  try { const { id, node } = await params; return NextResponse.json(await updateField(id, node, await jsonBody(request))); }
  catch (error) { return apiFailure(error); }
}
