import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

const taskSelect = { id: true, name: true, category: true, description: true } as const;

export async function listTasks(category?: string) {
  return prisma.task.findMany({
    where: category ? { category: { equals: category, mode: "insensitive" } } : undefined,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: taskSelect,
  });
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.task.findMany({
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  return rows.map((r) => r.category);
}

export async function getUserTasks(userId: string) {
  const rows = await prisma.userTask.findMany({
    where: { userId },
    orderBy: [{ task: { category: "asc" } }, { task: { name: "asc" } }],
    select: { task: { select: taskSelect } },
  });
  return rows.map((r) => r.task);
}

/** Replaces the user's whole selection in one transaction. */
export async function replaceUserTasks(userId: string, taskIds: string[]) {
  const uniqueIds = [...new Set(taskIds)];

  // Reject unknown ids up front, with a clear error instead of a raw FK failure.
  const found = await prisma.task.count({ where: { id: { in: uniqueIds } } });
  if (found !== uniqueIds.length) {
    throw new AppError(400, "INVALID_TASK_IDS", "One or more selected tasks do not exist");
  }

  // All-or-nothing: the user is never left with an empty or half-saved selection.
  await prisma.$transaction([
    prisma.userTask.deleteMany({ where: { userId } }),
    prisma.userTask.createMany({
      data: uniqueIds.map((taskId) => ({ userId, taskId })),
    }),
  ]);

  return getUserTasks(userId);
}