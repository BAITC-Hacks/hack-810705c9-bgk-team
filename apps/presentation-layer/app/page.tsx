import WorkspacePage from "@/_pages/workspace";
import { getDemoActor } from "@/shared/lib/demo-actor.server";

export default async function Page() {
  const actor = await getDemoActor();
  return <WorkspacePage initialRole={actor.role === "team" ? "student" : "business"} />;
}
