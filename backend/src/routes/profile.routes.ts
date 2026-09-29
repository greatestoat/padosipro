import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { profileSchema } from "../validators/profile.validator";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(profileController.getProfile));
router.put("/", validateBody(profileSchema), asyncHandler(profileController.saveProfile));

export default router;