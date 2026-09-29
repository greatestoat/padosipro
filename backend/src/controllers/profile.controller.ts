import { Request, Response } from "express";
import * as profileService from "../services/profile.service";
import { sendSuccess } from "../utils/apiResponse";
import { ProfileInput } from "../validators/profile.validator";

export async function getProfile(req: Request, res: Response) {
  const profile = await profileService.getProfile(req.user!.id);
  return sendSuccess(res, "Profile fetched", { profile });
}

export async function saveProfile(req: Request, res: Response) {
  const profile = await profileService.saveProfile(req.user!.id, req.body as ProfileInput);
  return sendSuccess(res, "Profile saved", { profile });
}