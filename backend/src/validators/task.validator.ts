import { z } from "zod";

export const taskQuerySchema = z.object({
  category: z.string().trim().min(1).max(50).optional(),
});

export const userTasksSchema = z.object({
  taskIds: z
    .array(z.string().uuid("Invalid task id"), { required_error: "taskIds is required" })
    .min(1, "Select at least one task")
    .max(50, "Too many tasks selected"),
});

export type UserTasksInput = z.infer<typeof userTasksSchema>;