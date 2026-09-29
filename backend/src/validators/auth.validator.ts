import { z } from "zod";

const email = z
  .string({ message: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email is too long");

// max 72: bcrypt ignores everything past 72 bytes.
const password = z
  .string({ message: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string({ message: "Confirm password is required" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const verifyOtpSchema = z.object({
  email,
  otp: z
    .string({ message: "OTP is required" })
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
});

export const loginSchema = z.object({
  email,
  // No strength rules here: login only checks the password against the hash.
  password: z.string({ message: "Password is required" }).min(1, "Password is required"),
});

export const resendOtpSchema = z.object({ email });

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;