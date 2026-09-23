import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecommendations } from "@/features/recommendations/api/get-recommendations";
import { RecommendationsView } from "@/features/recommendations/ui/recommendations-view";
import {
  teamIdParamSchema,
  VIEW_COOKIE,
  viewModeSchema,
} from "@/shared/api/contracts/task-match";
import { SEED_TEAMS } from "@/shared/db/seed/task-match-seed";
import { cn } from "@/shared/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamRecommendationsPage({
  params,
}: PageProps<"/teams/[id]/recommendations">) {
  const parsed = teamIdParamSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const teamId = parsed.data.id;

  const [store, recommendations] = await Promise.all([
    cookies(),
    getRecommendations(teamId),
  ]);
  if (!recommendations) notFound();
  const view = viewModeSchema.catch("deck").parse(store.get(VIEW_COOKIE)?.value);
  const team = SEED_TEAMS.find((item) => item.id === teamId);

  return (
    <main className="h-dvh overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Рекомендации команды</h1>
            <p className="text-sm text-muted-foreground">
              {team ? `${team.name}: ` : ""}
              задачи по ролям, навыкам и теме. Каталог доступен всегда.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Команда (демо)">
            {SEED_TEAMS.map((item) => (
              <Link
                key={item.id}
                href={`/teams/${item.id}/recommendations`}
                className={cn(
                  "rounded-lg px-2.5 py-1 ring-1 ring-foreground/10 hover:bg-muted",
                  item.id === teamId && "bg-primary text-primary-foreground hover:bg-primary/80",
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </header>
        <RecommendationsView
          key={teamId}
          teamId={teamId}
          initial={recommendations}
          view={view}
        />
      </div>
    </main>
  );
}
