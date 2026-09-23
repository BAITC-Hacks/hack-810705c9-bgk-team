import { NextResponse } from 'next/server';
import { checkpoint } from '@/features/task-match/api/tasks';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await checkpoint((await params).id, await jsonBody(request))); }
  catch (error) { return apiFailure(error); }
}
