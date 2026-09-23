import { demoAccessRepository, getAiLog, toErrorResponse } from "@/features/demo-access";
import { getDemoActor } from "@/shared/lib/demo-actor.server";

// ADR-008 п. 4: журнал AI — только бизнесу и только по своей задаче.
export async function GET(request: Request) {
  try {
    const actor = await getDemoActor();
    const taskId = new URL(request.url).searchParams.get("taskId");
    const entries = await getAiLog(actor, taskId, demoAccessRepository);
    return Response.json({ entries });
  } catch (error) {
    return toErrorResponse(error);
  }
}
