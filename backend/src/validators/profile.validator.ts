import { z } from "zod";

// Accepts "+919876543210", "9876543210", or with spaces/dashes ("+91 98765-43210").
// Always normalised to "+91XXXXXXXXXX" before it reaches the service.
// Indian mobile numbers start with 6, 7, 8 or 9.
const mobileNumber = z
  .string({ required_error: "Mobile number is required" })
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(
    z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid Indian mobile number (+91 followed by 10 digits)")
  )
  .transform((v) => (v.startsWith("+91") ? v : `+91${v}`));

export const profileSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  mobileNumber,
  address: z
    .string({ required_error: "Address is required" })
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(300, "Address must be at most 300 characters"),
  // Optional: missing, null, or blank all become null.
  businessName: z
    .string()
    .trim()
    .max(100, "Business name must be at most 100 characters")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type ProfileInput = z.infer<typeof profileSchema>;