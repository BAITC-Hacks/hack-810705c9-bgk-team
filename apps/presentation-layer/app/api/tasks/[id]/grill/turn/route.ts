import { NextResponse } from 'next/server';
import { answerGrillTurn } from '@/features/task-match/api/tasks';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await answerGrillTurn((await params).id, await jsonBody(request))); }
  catch (error) { return apiFailure(error); }
}
