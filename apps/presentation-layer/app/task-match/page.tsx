import { getDemoActor } from '@/shared/lib/demo-actor.server';
import { TaskMatchFlow } from '@/features/task-match/ui/task-match-flow';
export default async function Page({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
 const query = await searchParams;
 const actor = await getDemoActor();
 return <TaskMatchFlow key={JSON.stringify(actor)} actor={actor} initialTaskId={query.task} />;
}
