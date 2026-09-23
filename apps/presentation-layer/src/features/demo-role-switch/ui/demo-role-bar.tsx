import { getDemoActor, getDemoView } from "@/shared/lib/demo-actor.server";

import { DemoRoleSwitch } from "./demo-role-switch";

/** Server component: читает cookie запроса, поэтому роль и вид переживают перезагрузку. */
export async function DemoRoleBar() {
  const [actor, view] = await Promise.all([getDemoActor(), getDemoView()]);
  return <DemoRoleSwitch actor={actor} view={view} />;
}
