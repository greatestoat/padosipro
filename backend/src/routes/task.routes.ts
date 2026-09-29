import { Router } from "express";
import * as taskController from "../controllers/task.controller";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { userTasksSchema } from "../validators/task.validator";

// Mounted at /api/tasks
const taskRouter = Router();
taskRouter.use(authenticate);
taskRouter.get("/", asyncHandler(taskController.listTasks));
taskRouter.get("/categories", asyncHandler(taskController.listCategories));

// Mounted at /api/user/tasks
export const userTaskRouter = Router();
userTaskRouter.use(authenticate);
userTaskRouter.get("/", asyncHandler(taskController.getUserTasks));
userTaskRouter.put("/", validateBody(userTasksSchema), asyncHandler(taskController.saveUserTasks));

export default taskRouter;