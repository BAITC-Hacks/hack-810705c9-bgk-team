import { getDemoData } from "../../entities/workspace/demo-data";
import { calculateScore, TASK_FIELDS } from "../../entities/workspace/model";
import { db, type Database } from "./index";
import {
  businesses,
  milestones,
  proposals,
  scoreEvents,
  taskFields,
  tasks,
  teams,
} from "./schema";

/** Add fictional demo records without overwriting any existing workspace edits. */
export async function seedDemoData(database: Database = db) {
  const demo = getDemoData();
  const createdAt = new Date("2026-09-23T08:00:00.000Z");
  const completedProposalId = "proposal-school-sreda";

  return database.transaction(async (transaction) => {
    await transaction
      .insert(businesses)
      .values(
        demo.tasks.map((task) => ({
          id: `business-${task.id}`,
          name: task.company,
          industry: task.industry,
          createdAt: new Date(task.createdAt),
        })),
      )
      .onConflictDoNothing();

    const insertedTasks = await transaction
      .insert(tasks)
      .values(
        demo.tasks.map((task) => ({
          id: task.id,
          businessId: `business-${task.id}`,
          title: task.title,
          description: task.description,
          status: task.status,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.createdAt),
          publishedAt:
            task.status === "published" ? new Date(task.createdAt) : null,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: tasks.id });

    const newTaskIds = new Set(insertedTasks.map((task) => task.id));
    const newTasks = demo.tasks.filter((task) => newTaskIds.has(task.id));
    // Child fixtures belong only to newly inserted tasks, so repeated seeding
    // cannot restore fields or score history that someone intentionally changed.
    if (newTasks.length > 0) {
      await transaction
        .insert(taskFields)
        .values(
          newTasks.flatMap((task) =>
            TASK_FIELDS.map(({ key }) => ({
              taskId: task.id,
              node: key,
              value: task.fields[key],
              state: !task.fields[key].trim()
                ? ("empty" as const)
                : task.confirmedFields.includes(key)
                  ? ("confirmed" as const)
                  : ("suggested" as const),
            })),
          ),
        )
        .onConflictDoNothing();

      await transaction
        .insert(scoreEvents)
        .values(
          newTasks.map((task) => ({
            id: `score-initial-${task.id}`,
            taskId: task.id,
            previousScore: null,
            score: calculateScore(task),
            closedItems: [],
            createdAt: new Date(task.createdAt),
          })),
        )
        .onConflictDoNothing();
    }

    const insertedTeams = await transaction
      .insert(teams)
      .values(
        demo.teams.map((team) => ({
          ...team,
          createdAt,
          updatedAt: createdAt,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: teams.id });

    const insertedProposals = await transaction
      .insert(proposals)
      .values(
        demo.proposals.map((proposal) => ({
          id: proposal.id,
          taskId: proposal.taskId,
          teamId: proposal.teamId,
          idea: proposal.idea,
          plan: proposal.plan,
          timeline: proposal.timeline,
          prototypeUrl: proposal.prototypeUrl,
          status:
            proposal.id === completedProposalId
              ? ("selected" as const)
              : proposal.status,
          createdAt,
          updatedAt: createdAt,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: proposals.id });

    if (
      insertedProposals.some((proposal) => proposal.id === completedProposalId)
    ) {
      await transaction
        .insert(milestones)
        .values({
          id: "milestone-school-sreda",
          proposalId: completedProposalId,
          title: "Прототип карточки прогресса",
          resultUrl: "https://example.com/demo/student-progress",
          comment:
            "Демонстрационный результат: карточка и форма проверены на вымышленных данных.",
          status: "confirmed",
          submittedAt: new Date("2026-09-23T09:00:00.000Z"),
          confirmedAt: new Date("2026-09-23T09:30:00.000Z"),
        })
        .onConflictDoNothing();
    }

    return {
      tasks: insertedTasks.length,
      teams: insertedTeams.length,
      proposals: insertedProposals.length,
    };
  });
}
