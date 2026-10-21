import { logger } from "@/lib/security/logger";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

/**
 * Checks whether the Resend transactional email service is configured.
 */
export function isEmailServiceConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return Boolean(apiKey && apiKey.length > 5 && !apiKey.includes("placeholder"));
}

/**
 * Sends a transactional email using Resend's REST API.
 * Uses native fetch without heavy third-party dependencies.
 * Fails gracefully when unconfigured or on network failure, without throwing exceptions.
 */
export async function sendTransactionalEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey || apiKey.includes("placeholder")) {
    logger.warn("Transactional email skipped: RESEND_API_KEY is not configured", {
      subject: options.subject,
      recipientCount: Array.isArray(options.to) ? options.to.length : 1,
    });
    return {
      sent: false,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  const from = options.from || process.env.EMAIL_FROM || "Company Brain <onboarding@resend.dev>";
  const toList = Array.isArray(options.to) ? options.to : [options.to];

  // Basic recipient validation
  const validRecipients = toList.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
  if (validRecipients.length === 0) {
    return {
      sent: false,
      error: "No valid recipient email addresses provided.",
    };
  }

  // Generate simple text fallback if omitted
  const textContent =
    options.text ||
    options.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: validRecipients,
        subject: options.subject,
        html: options.html,
        text: textContent,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      let errorMessage = `Resend API returned status ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Response was not JSON
      }

      logger.error("Resend email dispatch failed", new Error(errorMessage), {
        status: res.status,
        subject: options.subject,
      });

      return {
        sent: false,
        error: errorMessage,
      };
    }

    const data = await res.json();
    logger.info("Transactional email dispatched successfully", {
      id: data?.id,
      subject: options.subject,
      recipients: validRecipients.length,
    });

    return {
      sent: true,
      id: data?.id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error during email dispatch";
    logger.error("Exception occurred while sending transactional email", err, {
      subject: options.subject,
    });
    return {
      sent: false,
      error: message,
    };
  }
}
