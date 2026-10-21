import { sendTransactionalEmail, SendEmailResult } from "@/lib/email/resend";

export interface OperationalNotificationData {
  recipientEmail: string;
  recipientName?: string;
  organizationName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderOperationalEmail(data: OperationalNotificationData): {
  subject: string;
  html: string;
  text: string;
} {
  const safeOrgName = escapeHtml(data.organizationName || "Company Brain");
  const safeTitle = escapeHtml(data.title);
  const safeMessage = escapeHtml(data.message).replace(/\n/g, "<br>");
  const safeRecipient = escapeHtml(data.recipientName || "there");
  const subject = `[${safeOrgName}] ${safeTitle}`;

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
      padding: 28px 36px 20px;
      border-bottom: 1px solid #1f1f23;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 32px 36px 24px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 16px;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
      margin: 0 0 20px;
    }
    .cta-container {
      margin: 24px 0 12px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 13px;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 8px;
    }
    .footer {
      padding: 20px 36px;
      border-top: 1px solid #1f1f23;
      font-size: 12px;
      color: #52525b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td class="header">
          <p class="brand-name">Company Brain &bull; ${safeOrgName}</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h1 class="title">${safeTitle}</h1>
          <p class="text">Hi ${safeRecipient},</p>
          <p class="text">${safeMessage}</p>
          ${
            data.actionUrl
              ? `<div class="cta-container">
            <a href="${escapeHtml(data.actionUrl)}" class="button" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(data.actionLabel || "View in Workspace")}
            </a>
          </div>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0;">
            This is an operational notification from ${safeOrgName}.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const text = `[${data.organizationName}] ${data.title}

Hi ${data.recipientName || "there"},

${data.message}
${data.actionUrl ? `\nView here: ${data.actionUrl}\n` : ""}
---
Operational notification from ${data.organizationName} via Company Brain.`;

  return { subject, html, text };
}

export async function sendOperationalNotification(
  data: OperationalNotificationData
): Promise<SendEmailResult> {
  const { subject, html, text } = renderOperationalEmail(data);
  return sendTransactionalEmail({
    to: data.recipientEmail,
    subject,
    html,
    text,
  });
}
