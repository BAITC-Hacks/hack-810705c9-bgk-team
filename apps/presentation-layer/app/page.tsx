import WorkspacePage from "@/_pages/workspace";
import { getDemoActor } from "@/shared/lib/demo-actor.server";
import { demoActorId } from "@/shared/lib/demo-actor";

export default async function Page() {
  const actor = await getDemoActor();
  return <WorkspacePage key={`${actor.role}:${demoActorId(actor)}`} />;
}
