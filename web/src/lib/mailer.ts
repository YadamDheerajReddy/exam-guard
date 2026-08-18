import "server-only";
import nodemailer from "nodemailer";

// Free credential-delivery email (org admin / student / invigilator temp
// passwords) via a Gmail account + App Password — no domain or paid email
// service required. GMAIL_USER/GMAIL_APP_PASSWORD are set in .env.local;
// see .env.example for how to generate the App Password.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
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
    console.error(`[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not configured — skipped email to ${to}`);
    return { ok: false, error: "Email is not configured." };
  }

  try {
    await t.sendMail({
      from: `ExamGuard <${process.env.GMAIL_USER}>`,
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
