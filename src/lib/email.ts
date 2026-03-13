import nodemailer from "nodemailer";

export type EmailResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string };

export async function sendApplicationEmail(
  to: string,
  subject: string,
  text: string,
  attachments?: { filename: string; content: Buffer }[]
): Promise<EmailResult> {
  const host = process.env.SMTP_HOST ?? "smtp.prontoloans.co.za";
  const port = process.env.SMTP_PORT ?? "465";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@prontoloans.co.za";

  if (!host || !port || !from) {
    return {
      sent: false,
      skipped: true,
      reason: "SMTP configuration incomplete.",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      attachments,
    });
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      reason:
        error instanceof Error ? error.message : "Failed to send email.",
    };
  }
}
