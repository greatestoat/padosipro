import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  loginSchema,
  registerSchema,
  resendOtpSchema,
  verifyOtpSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/register", validateBody(registerSchema), asyncHandler(authController.register));
router.post("/verify-otp", validateBody(verifyOtpSchema), asyncHandler(authController.verifyOtp));
router.post("/resend-otp", validateBody(resendOtpSchema), asyncHandler(authController.resendOtp));
router.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
router.post("/logout", authenticate, asyncHandler(authController.logout));

export default router;