import { sendTransactionalEmail, SendEmailResult } from "@/lib/email/resend";

export interface InvitationEmailData {
  organizationName: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
  inviteUrl: string;
  role?: string;
  expiresAt?: string;
}

/**
 * Escapes characters with special meaning in HTML to prevent XSS / markup injection.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats an ISO date string into a user-friendly expiration text.
 */
function formatExpiration(expiresAt?: string): string {
  if (!expiresAt) return "7 days";
  try {
    const date = new Date(expiresAt);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "7 days";
  }
}

/**
 * Renders the HTML and Plain Text templates for an organization workspace invitation.
 */
export function renderInvitationEmail(data: InvitationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const safeOrgName = escapeHtml(data.organizationName || "Company Brain Workspace");
  const safeInviterName = escapeHtml(data.inviterName || "A team member");
  const safeInviterEmail = data.inviterEmail ? escapeHtml(data.inviterEmail) : null;
  const roleDisplay = (data.role || "member").toLowerCase() === "admin" ? "Administrator" : "Member";
  const expirationText = formatExpiration(data.expiresAt);
  const rawUrl = data.inviteUrl.trim();
  const safeInviteUrl = escapeHtml(rawUrl);

  const subject = `You've been invited to join ${safeOrgName} on Company Brain`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f4f4f5;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #09090b;
      padding: 40px 0;
    }
    .main {
      background-color: #141416;
      margin: 0 auto;
      width: 100%;
      max-width: 560px;
      border: 1px solid #27272a;
      border-radius: 14px;
      overflow: hidden;
    }
    .header {
      padding: 32px 36px 20px;
      text-align: center;
      border-bottom: 1px solid #1f1f23;
    }
    .logo-badge {
      display: inline-block;
      width: 40px;
      height: 40px;
      line-height: 40px;
      background: #2563eb;
      border-radius: 10px;
      color: #ffffff;
      font-weight: 800;
      font-size: 18px;
      text-align: center;
      margin-bottom: 12px;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 36px 36px 24px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
      line-height: 1.3;
      margin: 0 0 16px;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
      margin: 0 0 20px;
    }
    .badge {
      display: inline-block;
      background-color: #1e293b;
      color: #93c5fd;
      font-size: 12px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #3b82f6;
    }
    .cta-container {
      margin: 28px 0;
      text-align: center;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 14px;
      padding: 13px 28px;
      text-decoration: none;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
      transition: background-color 0.15s ease;
    }
    .url-fallback {
      background-color: #0c0c0e;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 14px;
      margin-top: 24px;
      font-size: 11px;
      word-break: break-all;
      color: #71717a;
      line-height: 1.5;
    }
    .url-link {
      color: #60a5fa;
      text-decoration: underline;
    }
    .footer {
      padding: 24px 36px;
      border-top: 1px solid #1f1f23;
      font-size: 12px;
      color: #52525b;
      line-height: 1.5;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td class="header">
          <div class="logo-badge">CB</div>
          <p class="brand-name">Company Brain</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h1 class="title">Join ${safeOrgName}</h1>
          <p class="text">
            <strong>${safeInviterName}</strong>${safeInviterEmail ? ` (${safeInviterEmail})` : ""} has invited you to join the <strong>${safeOrgName}</strong> workspace as a <span class="badge">${roleDisplay}</span>.
          </p>
          <p class="text">
            Company Brain centralizes company knowledge, decisions, documentation, and operations in a unified workspace.
          </p>
          <div class="cta-container">
            <a href="${safeInviteUrl}" class="button" target="_blank" rel="noopener noreferrer">Accept Invitation</a>
          </div>
          <p class="text" style="font-size: 12px; color: #71717a; text-align: center; margin-top: 16px;">
            This single-use invitation expires on <strong>${expirationText}</strong>.
          </p>
          <div class="url-fallback">
            <p style="margin: 0 0 6px; font-weight: 600; color: #a1a1aa;">Having trouble with the button?</p>
            Copy and paste this URL directly into your browser:<br>
            <a href="${safeInviteUrl}" class="url-link" target="_blank" rel="noopener noreferrer">${safeInviteUrl}</a>
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0 0 8px;">
            If you were not expecting this invitation, you can safely ignore this email. Only someone with access to this link can join the workspace.
          </p>
          <p style="margin: 0;">
            &copy; ${new Date().getFullYear()} Company Brain Inc. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const text = `Join ${data.organizationName} on Company Brain

${data.inviterName || "A team member"}${data.inviterEmail ? ` (${data.inviterEmail})` : ""} has invited you to join the ${data.organizationName} workspace as a ${roleDisplay}.

Accept your invitation by visiting the link below:
${rawUrl}

This single-use link expires on ${expirationText}.

---
If you were not expecting this invitation, you can safely ignore this email.
(c) ${new Date().getFullYear()} Company Brain Inc.`;

  return { subject, html, text };
}

/**
 * Convenience helper to render and send an organization invitation email in one call.
 */
export async function sendInvitationEmail(
  params: InvitationEmailData & { to: string }
): Promise<SendEmailResult> {
  const { subject, html, text } = renderInvitationEmail(params);
  return sendTransactionalEmail({
    to: params.to,
    subject,
    html,
    text,
  });
}
