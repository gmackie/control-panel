/**
 * Email Notification Channel
 * 
 * Delivers notifications via email (using SendGrid or similar)
 */

import { Notification, EmailMessage, DeliveryResult } from "../types";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || "notifications@gmac.io";
const FROM_NAME = process.env.NOTIFICATION_FROM_NAME || "GMAC Control Panel";

/**
 * Build HTML email from notification
 */
function buildEmailHtml(notification: Notification): string {
  const severityColors: Record<string, string> = {
    info: "#3b82f6",
    warning: "#f59e0b",
    error: "#ef4444",
    critical: "#dc2626",
  };

  const color = severityColors[notification.severity] || "#6b7280";

  let linksHtml = "";
  if (notification.links && notification.links.length > 0) {
    linksHtml = `
      <div style="margin-top: 16px;">
        ${notification.links
          .map(
            (link) =>
              `<a href="${link.url}" style="display: inline-block; margin-right: 8px; padding: 8px 16px; background-color: #374151; color: #ffffff; text-decoration: none; border-radius: 4px;">${link.label}</a>`
          )
          .join("")}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #111827; color: #f3f4f6; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #1f2937; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <div style="background-color: ${color}; padding: 16px 24px;">
          <h1 style="margin: 0; font-size: 18px; color: #ffffff;">
            ${notification.title}
          </h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6;">
            ${notification.message}
          </p>
          
          <!-- Metadata -->
          <div style="background-color: #374151; border-radius: 4px; padding: 12px; margin-top: 16px;">
            <table style="width: 100%; font-size: 12px;">
              <tr>
                <td style="color: #9ca3af; padding: 4px 8px 4px 0;">Source:</td>
                <td style="color: #f3f4f6;">${notification.source}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 4px 8px 4px 0;">Category:</td>
                <td style="color: #f3f4f6;">${notification.category}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; padding: 4px 8px 4px 0;">Severity:</td>
                <td style="color: ${color}; text-transform: uppercase; font-weight: 600;">${notification.severity}</td>
              </tr>
              ${
                notification.appName
                  ? `<tr>
                      <td style="color: #9ca3af; padding: 4px 8px 4px 0;">Application:</td>
                      <td style="color: #f3f4f6;">${notification.appName}</td>
                    </tr>`
                  : ""
              }
              ${
                notification.environment
                  ? `<tr>
                      <td style="color: #9ca3af; padding: 4px 8px 4px 0;">Environment:</td>
                      <td style="color: #f3f4f6;">${notification.environment}</td>
                    </tr>`
                  : ""
              }
            </table>
          </div>
          
          ${linksHtml}
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px 24px; background-color: #111827; border-top: 1px solid #374151; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">
            This notification was sent by GMAC Control Panel.
            <a href="#" style="color: #60a5fa;">Manage notification preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build plain text email from notification
 */
function buildEmailText(notification: Notification): string {
  let text = `${notification.title}\n\n`;
  text += `${notification.message}\n\n`;
  text += `---\n`;
  text += `Source: ${notification.source}\n`;
  text += `Category: ${notification.category}\n`;
  text += `Severity: ${notification.severity.toUpperCase()}\n`;
  
  if (notification.appName) {
    text += `Application: ${notification.appName}\n`;
  }
  if (notification.environment) {
    text += `Environment: ${notification.environment}\n`;
  }
  
  if (notification.links && notification.links.length > 0) {
    text += `\nLinks:\n`;
    notification.links.forEach((link) => {
      text += `- ${link.label}: ${link.url}\n`;
    });
  }
  
  return text;
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(message: EmailMessage): Promise<DeliveryResult> {
  if (!SENDGRID_API_KEY) {
    return {
      channel: "email",
      success: false,
      error: "SendGrid API key not configured",
      timestamp: new Date(),
    };
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: message.to.map((email) => ({ email })),
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        subject: message.subject,
        content: [
          {
            type: "text/plain",
            value: message.text || "",
          },
          {
            type: "text/html",
            value: message.html,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        channel: "email",
        success: false,
        error: `SendGrid error: ${response.status} - ${error}`,
        timestamp: new Date(),
      };
    }

    const messageId = response.headers.get("x-message-id") || undefined;

    return {
      channel: "email",
      success: true,
      messageId,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      channel: "email",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date(),
    };
  }
}

/**
 * Send notification via email
 */
export async function sendEmailNotification(
  notification: Notification,
  toEmails: string[]
): Promise<DeliveryResult> {
  if (toEmails.length === 0) {
    return {
      channel: "email",
      success: false,
      error: "No recipient email addresses",
      timestamp: new Date(),
    };
  }

  const severityPrefix: Record<string, string> = {
    info: "[Info]",
    warning: "[Warning]",
    error: "[Error]",
    critical: "[CRITICAL]",
  };

  const prefix = severityPrefix[notification.severity] || "";
  const subject = `${prefix} ${notification.title}`.trim();

  const message: EmailMessage = {
    to: toEmails,
    subject,
    html: buildEmailHtml(notification),
    text: buildEmailText(notification),
  };

  return sendViaSendGrid(message);
}

/**
 * Test email connection
 */
export async function testEmailConnection(toEmail: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false;

  try {
    const result = await sendViaSendGrid({
      to: [toEmail],
      subject: "Test Email - Control Panel",
      html: "<p>This is a test email from GMAC Control Panel. Email integration is working!</p>",
      text: "This is a test email from GMAC Control Panel. Email integration is working!",
    });
    return result.success;
  } catch {
    return false;
  }
}
