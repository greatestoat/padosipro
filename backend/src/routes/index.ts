import { Router } from "express";
import { prisma } from "../config/prisma";
import { sendSuccess } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import authRoutes from "./auth.routes";
import profileRoutes from "./profile.routes";
import taskRoutes, { userTaskRouter } from "./task.routes";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;

    sendSuccess(res, "PadosiPro API is running", {
      database: "up",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  })
);

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/tasks", taskRoutes);
router.use("/user/tasks", userTaskRouter);

export default router;