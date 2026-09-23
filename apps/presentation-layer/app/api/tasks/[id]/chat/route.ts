import { requireTaskOwner } from "@/features/task-card/api/access";
import { chatRequestSchema } from "@/entities/workspace/chat-contracts";
import { idSchema } from "@/entities/workspace/contracts";
import { generateChatReply } from "@/server/workspace/chat";
import { apiRoute, jsonBody } from "@/server/workspace/http";
import { getTask, requireRole } from "@/server/workspace/service";

export const runtime = "nodejs";

export const POST = apiRoute(async (request, context, session) => {
  requireRole(session, "business");
  const id = idSchema.parse((await context.params).id);
  const { messages } = await jsonBody(request, chatRequestSchema);
  await getTask(id, session);
  await requireTaskOwner(id);
  return generateChatReply(messages, request.signal);
});
