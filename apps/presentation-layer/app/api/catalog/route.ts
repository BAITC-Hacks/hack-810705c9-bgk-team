import { apiRoute } from "@/server/workspace/http";
import { getWorkspace } from "@/server/workspace/service";
import { calculateScore } from "@/entities/workspace/model";
import { evaluateTask } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(async (request, _context, session) => {
  const { tasks } = await getWorkspace({ ...session, role: "student" });
  const query = new URL(request.url).searchParams;
  const search = query.get("q")?.trim().toLocaleLowerCase("ru") ?? "";
  return tasks
    .filter(
      (task) =>
        (!query.get("industry") || task.industry === query.get("industry")) &&
        (!query.get("level") ||
          evaluateTask(task).level === query.get("level")) &&
        (!search ||
          `${task.title} ${task.company} ${task.industry}`
            .toLocaleLowerCase("ru")
            .includes(search)),
    )
    .sort(
      (first, second) =>
        calculateScore(second) - calculateScore(first) ||
        (second.publishedAt ?? second.createdAt).localeCompare(
          first.publishedAt ?? first.createdAt,
        ),
    );
});
