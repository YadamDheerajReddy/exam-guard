import "server-only";
import nodemailer from "nodemailer";

// Credential-delivery email (org admin / student / invigilator temp
// passwords, password resets) via plain SMTP — works with any provider
// (Gmail App Password, Hostinger/Titan business email, etc.). See
// .env.example for the exact settings per provider.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !port || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    // 465 is implicit TLS; 587 (and everything else) is STARTTLS.
    secure: Number(port) === 465,
    auth: { user, pass },
  });
  return transporter;
}

// Failures are logged, not thrown — a missing/misconfigured mail account
// shouldn't block the account-creation flow that triggered the email
// (the admin can still see/copy the temp password from the UI either way).
export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    console.error(`[mailer] SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD not configured — skipped email to ${to}`);
    return { ok: false, error: "Email is not configured." };
  }

  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || `ExamGuard <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error.";
    console.error(`[mailer] failed to send to ${to}:`, message);
    return { ok: false, error: message };
  }
}
