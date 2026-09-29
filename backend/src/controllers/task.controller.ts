import { Request, Response } from "express";
import * as taskService from "../services/task.service";
import { sendSuccess } from "../utils/apiResponse";
import { taskQuerySchema, UserTasksInput } from "../validators/task.validator";

export async function listTasks(req: Request, res: Response) {
  const { category } = taskQuerySchema.parse(req.query);
  const tasks = await taskService.listTasks(category);
  return sendSuccess(res, "Tasks fetched", { tasks });
}

export async function listCategories(_req: Request, res: Response) {
  const categories = await taskService.listCategories();
  return sendSuccess(res, "Categories fetched", { categories });
}

export async function getUserTasks(req: Request, res: Response) {
  const tasks = await taskService.getUserTasks(req.user!.id);
  return sendSuccess(res, "Selected tasks fetched", { tasks });
}

export async function saveUserTasks(req: Request, res: Response) {
  const { taskIds } = req.body as UserTasksInput;
  const tasks = await taskService.replaceUserTasks(req.user!.id, taskIds);
  return sendSuccess(res, "Tasks saved", { tasks });
}