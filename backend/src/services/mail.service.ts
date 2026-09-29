import { transporter } from "../config/mailer";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: "Your PadosiPro verification code",
      text:
        `Your PadosiPro verification code is ${code}.\n` +
        `It expires in ${env.OTP_TTL_MINUTES} minutes. If you didn't request it, ignore this email.`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:420px">` +
        `<h2>Verify your email</h2>` +
        `<p>Your verification code is:</p>` +
        `<p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p>` +
        `<p>It expires in ${env.OTP_TTL_MINUTES} minutes. If you didn't request it, ignore this email.</p>` +
        `</div>`,
    });
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    throw new AppError(
      502,
      "EMAIL_SEND_FAILED",
      "We couldn't send the verification email. Please try resending the code."
    );
  }
}