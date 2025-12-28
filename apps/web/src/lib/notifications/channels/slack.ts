/**
 * Slack Notification Channel
 * 
 * Delivers notifications to Slack via webhook
 */

import { Notification, SlackMessage, DeliveryResult } from "../types";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

/**
 * Build Slack message blocks from notification
 */
function buildSlackMessage(notification: Notification): SlackMessage {
  const severityEmoji: Record<string, string> = {
    info: ":information_source:",
    warning: ":warning:",
    error: ":x:",
    critical: ":rotating_light:",
  };

  const emoji = severityEmoji[notification.severity] || ":bell:";
  
  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${notification.title}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: notification.message,
      },
    },
  ];

  // Add context
  const contextElements: unknown[] = [
    {
      type: "mrkdwn",
      text: `*Source:* ${notification.source}`,
    },
    {
      type: "mrkdwn",
      text: `*Severity:* ${notification.severity}`,
    },
    {
      type: "mrkdwn",
      text: `*Category:* ${notification.category}`,
    },
  ];

  if (notification.appName) {
    contextElements.push({
      type: "mrkdwn",
      text: `*App:* ${notification.appName}`,
    });
  }

  if (notification.environment) {
    contextElements.push({
      type: "mrkdwn",
      text: `*Env:* ${notification.environment}`,
    });
  }

  blocks.push({
    type: "context",
    elements: contextElements,
  });

  // Add action buttons if there are links
  if (notification.links && notification.links.length > 0) {
    const buttons = notification.links.slice(0, 3).map((link, i) => ({
      type: "button",
      text: {
        type: "plain_text",
        text: link.label,
        emoji: true,
      },
      url: link.url,
      action_id: `link_${i}`,
    }));

    blocks.push({
      type: "actions",
      elements: buttons,
    });
  }

  // Add divider
  blocks.push({ type: "divider" });

  return {
    text: `${emoji} ${notification.title}: ${notification.message}`,
    blocks,
  };
}

/**
 * Send notification to Slack
 */
export async function sendSlackNotification(
  notification: Notification,
  webhookUrl?: string
): Promise<DeliveryResult> {
  const url = webhookUrl || SLACK_WEBHOOK_URL;
  
  if (!url) {
    return {
      channel: "slack",
      success: false,
      error: "Slack webhook URL not configured",
      timestamp: new Date(),
    };
  }

  try {
    const message = buildSlackMessage(notification);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        channel: "slack",
        success: false,
        error: `Slack API error: ${response.status} - ${error}`,
        timestamp: new Date(),
      };
    }

    return {
      channel: "slack",
      success: true,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      channel: "slack",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date(),
    };
  }
}

/**
 * Test Slack connection
 */
export async function testSlackConnection(webhookUrl?: string): Promise<boolean> {
  const url = webhookUrl || SLACK_WEBHOOK_URL;
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Test message from Control Panel - Slack integration is working!",
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
