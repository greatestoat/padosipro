import nodemailer from "nodemailer";
import { env } from "./env";

// Mailpit accepts plain SMTP on port 1025 with no TLS or auth.
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  ignoreTLS: true,
});