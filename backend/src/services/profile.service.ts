import { prisma } from "../config/prisma";
import { ProfileInput } from "../validators/profile.validator";

// Only public fields leave the API. Internal ids are never exposed.
const profileSelect = {
  name: true,
  mobileNumber: true,
  address: true,
  businessName: true,
  updatedAt: true,
} as const;

export async function getProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId }, select: profileSelect });
}

/** Creates the profile on first call, updates it afterwards. */
export async function saveProfile(userId: string, input: ProfileInput) {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
    select: profileSelect,
  });
}