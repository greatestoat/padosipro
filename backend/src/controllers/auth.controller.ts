import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { sendSuccess } from "../utils/apiResponse";
import {
  LoginInput,
  RegisterInput,
  ResendOtpInput,
  VerifyOtpInput,
} from "../validators/auth.validator";

export async function register(req: Request, res: Response) {
  const { email, password } = req.body as RegisterInput;
  const data = await authService.register(email, password);
  return sendSuccess(res, "Registered. A verification code has been sent to your email", data, 201);
}

export async function verifyOtp(req: Request, res: Response) {
  const { email, otp } = req.body as VerifyOtpInput;
  const data = await authService.verifyEmail(email, otp);
  return sendSuccess(res, "Email verified successfully. You can now log in", data);
}

export async function resendOtp(req: Request, res: Response) {
  const { email } = req.body as ResendOtpInput;
  const data = await authService.resendOtp(email);
  return sendSuccess(res, "If the account exists and is unverified, a new code has been sent", data);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;
  const data = await authService.login(email, password);
  return sendSuccess(res, "Login successful", data);
}

export async function logout(_req: Request, res: Response) {
  // JWTs are stateless: the mobile app deletes its stored token.
  // The endpoint exists so the client has one place to call, and so we can
  // add server-side revocation later without changing the API.
  return sendSuccess(res, "Logged out successfully");
}