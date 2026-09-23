import { NextResponse } from 'next/server';
import { createTask, listTasks } from '@/features/task-match/api/tasks';
import { apiFailure, jsonBody } from '@/features/task-match/api/http';

export async function GET() {
  try { return NextResponse.json(await listTasks()); }
  catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try { return NextResponse.json(await createTask(await jsonBody(request)), { status: 201 }); }
  catch (error) { return apiFailure(error); }
}
