// Plain, inline-styled HTML — kept simple since these are transactional
// credential emails read mostly in webmail clients that strip <style>
// blocks and external CSS.
function shell(title: string, bodyHtml: string) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2430;">
      <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: #1a3c6e; margin: 0 0 24px;">EXAMGUARD</p>
      <h1 style="font-size: 18px; margin: 0 0 16px;">${title}</h1>
      ${bodyHtml}
      <p style="font-size: 12px; color: #6b7280; margin-top: 32px;">
        This is an automated message from ExamGuard. If you weren't expecting this, you can ignore it.
      </p>
    </div>
  `;
}

function credentialBlock(rows: { label: string; value: string }[]) {
  const cells = rows
    .map(
      (r) => `
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #6b7280;">${r.label}</td>
          <td style="padding: 6px 0; font-size: 14px; font-family: monospace; color: #10131a; text-align: right;">${r.value}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <table style="width: 100%; border-collapse: collapse; background: #f4f7fb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <tbody>${cells}</tbody>
    </table>
  `;
}

export function studentPasswordResetEmail({
  fullName,
  resetUrl,
  expiresInMinutes,
}: {
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  return {
    subject: "Reset your ExamGuard student password",
    html: shell(
      "Reset your password",
      `
        <p style="font-size: 14px; line-height: 1.6;">Hi ${fullName},</p>
        <p style="font-size: 14px; line-height: 1.6;">
          We received a request to reset your ExamGuard student password. Click below to choose a new one —
          this link works once and expires in ${expiresInMinutes} minutes.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #1a3c6e; color: #ffffff; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
            Choose a new password →
          </a>
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #6b7280;">
          If you didn't request this, you can safely ignore this email — your password won't change unless you
          open this link and set a new one.
        </p>
      `,
    ),
  };
}

// Shared by admin and invigilator self-service reset — same shape as
// studentPasswordResetEmail, parameterized by role so the copy is
// accurate for whichever account is resetting.
export function accountPasswordResetEmail({
  fullName,
  resetUrl,
  expiresInMinutes,
  roleLabel,
}: {
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
  roleLabel: string;
}) {
  return {
    subject: `Reset your ${roleLabel} password`,
    html: shell(
      "Reset your password",
      `
        <p style="font-size: 14px; line-height: 1.6;">Hi ${fullName},</p>
        <p style="font-size: 14px; line-height: 1.6;">
          We received a request to reset your ${roleLabel} password. Click below to choose a new one —
          this link works once and expires in ${expiresInMinutes} minutes.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #1a3c6e; color: #ffffff; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
            Choose a new password →
          </a>
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #6b7280;">
          If you didn't request this, you can safely ignore this email — your password won't change unless you
          open this link and set a new one.
        </p>
      `,
    ),
  };
}

export function orgAdminCreatedEmail({
  orgName,
  fullName,
  email,
  tempPassword,
  loginUrl,
}: {
  orgName: string;
  fullName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}) {
  return {
    subject: `Your ExamGuard admin account for ${orgName}`,
    html: shell(
      "You've been set up as an admin",
      `
        <p style="font-size: 14px; line-height: 1.6;">Hi ${fullName},</p>
        <p style="font-size: 14px; line-height: 1.6;">
          An ExamGuard admin account has been created for <strong>${orgName}</strong>. Use these credentials to sign in — you'll be asked to set your own password and Organization ID on first login.
        </p>
        ${credentialBlock([
          { label: "Login email", value: email },
          { label: "Temporary password", value: tempPassword },
        ])}
        <p style="font-size: 14px; line-height: 1.6;">
          <a href="${loginUrl}" style="color: #1a3c6e; font-weight: 600;">Sign in to the Admin Console →</a>
        </p>
      `,
    ),
  };
}

export function orgAdminPasswordResetEmail({
  orgName,
  fullName,
  email,
  tempPassword,
  loginUrl,
}: {
  orgName: string;
  fullName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}) {
  return {
    subject: `Your ExamGuard admin password for ${orgName} was reset`,
    html: shell(
      "Your password was reset",
      `
        <p style="font-size: 14px; line-height: 1.6;">Hi ${fullName},</p>
        <p style="font-size: 14px; line-height: 1.6;">
          An ExamGuard super admin reset your admin password for <strong>${orgName}</strong>. Use this temporary
          password to sign in — you'll be asked to set a new one immediately.
        </p>
        ${credentialBlock([
          { label: "Login email", value: email },
          { label: "Temporary password", value: tempPassword },
        ])}
        <p style="font-size: 14px; line-height: 1.6;">
          <a href="${loginUrl}" style="color: #1a3c6e; font-weight: 600;">Sign in to the Admin Console →</a>
        </p>
      `,
    ),
  };
}

export function studentCreatedEmail({
  orgName,
  fullName,
  rollNumber,
  organizationId,
  tempPassword,
  loginUrl,
}: {
  orgName: string;
  fullName: string;
  rollNumber: string;
  organizationId: string;
  tempPassword: string;
  loginUrl: string;
}) {
  return {
    subject: `Your ExamGuard student login for ${orgName}`,
    html: shell(
      "Your exam pass account is ready",
      `
        <p style="font-size: 14px; line-height: 1.6;">Hi ${fullName},</p>
        <p style="font-size: 14px; line-height: 1.6;">
          You've been added to <strong>${orgName}</strong>'s exam roster on ExamGuard. Sign in with these details to view your exam schedule and barcode pass — you'll be asked to set your own password on first login.
        </p>
        ${credentialBlock([
          { label: "Organization ID", value: organizationId },
          { label: "Roll number", value: rollNumber },
          { label: "Temporary password", value: tempPassword },
        ])}
        <p style="font-size: 14px; line-height: 1.6;">
          <a href="${loginUrl}" style="color: #1a3c6e; font-weight: 600;">Sign in to the Student Portal →</a>
        </p>
      `,
    ),
  };
}

export function invigilatorCreatedEmail({
  orgName,
  fullName,
  email,
  tempPassword,
}: {
  orgName: string;
  fullName: string;
  email: string;
  tempPassword: string;
}) {
  return {
    subject: `Your ExamGuard invigilator login for ${orgName}`,
    html: shell(
      "You've been added as an invigilator",
      `
        <p style="font-size: 14px; line-height: 1.6;">Hi ${fullName},</p>
        <p style="font-size: 14px; line-height: 1.6;">
          You've been set up as an invigilator for <strong>${orgName}</strong> on ExamGuard. Sign in from the ExamGuard Scanner app with these details — you'll be asked to set your own password on first login.
        </p>
        ${credentialBlock([
          { label: "Login email", value: email },
          { label: "Temporary password", value: tempPassword },
        ])}
      `,
    ),
  };
}
