/**
 * Notification Rules Engine
 * 
 * Matches events against rules, applies deduplication, and orchestrates delivery
 */

import { notificationService } from "./notification-service";
import { sendSlackNotification, sendEmailNotification, sendPushNotification } from "./channels";
import {
  Notification,
  CreateNotification,
  NotificationRule,
  RuleConditions,
  ChannelConfig,
  DedupeSettings,
  ScheduleSettings,
  NotificationSeverity,
  DeliveryResult,
  ChannelType,
} from "./types";

// In-memory deduplication cache
interface DedupeEntry {
  groupKey: string;
  notificationId: string;
  count: number;
  lastSeen: Date;
  expiresAt: Date;
}

const dedupeCache = new Map<string, DedupeEntry>();

// Severity order for comparisons
const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

/**
 * Check if severity meets minimum threshold
 */
function meetsMinSeverity(
  severity: NotificationSeverity,
  minSeverity: NotificationSeverity | undefined
): boolean {
  if (!minSeverity) return true;
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[minSeverity];
}

/**
 * Check if conditions match a notification
 */
function matchesConditions(
  notification: CreateNotification,
  conditions: RuleConditions
): boolean {
  // Check sources
  if (conditions.sources && conditions.sources.length > 0) {
    if (!conditions.sources.includes(notification.source)) {
      return false;
    }
  }

  // Check categories
  if (conditions.categories && conditions.categories.length > 0) {
    if (!conditions.categories.includes(notification.category)) {
      return false;
    }
  }

  // Check severities
  if (conditions.severities && conditions.severities.length > 0) {
    if (!conditions.severities.includes(notification.severity)) {
      return false;
    }
  }

  // Check app IDs
  if (conditions.appIds && conditions.appIds.length > 0) {
    if (!notification.appId || !conditions.appIds.includes(notification.appId)) {
      return false;
    }
  }

  // Check environments
  if (conditions.environments && conditions.environments.length > 0) {
    if (!notification.environment || !conditions.environments.includes(notification.environment)) {
      return false;
    }
  }

  // Check title contains
  if (conditions.titleContains) {
    if (!notification.title.toLowerCase().includes(conditions.titleContains.toLowerCase())) {
      return false;
    }
  }

  // Check title regex
  if (conditions.titleRegex) {
    try {
      const regex = new RegExp(conditions.titleRegex, "i");
      if (!regex.test(notification.title)) {
        return false;
      }
    } catch {
      console.error("Invalid regex in rule conditions:", conditions.titleRegex);
      return false;
    }
  }

  return true;
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(schedule: ScheduleSettings | undefined): boolean {
  if (!schedule || !schedule.quietHoursEnabled) {
    return false;
  }

  if (!schedule.quietHoursStart || !schedule.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const timezone = schedule.quietHoursTimezone || "UTC";
  
  // Get current time in the specified timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const currentTime = formatter.format(now);
  const [currentHour, currentMinute] = currentTime.split(":").map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  // Parse quiet hours
  const [startHour, startMinute] = schedule.quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = schedule.quietHoursEnd.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    // Quiet hours span midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Quiet hours within same day
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Check if current day is allowed
 */
function isDayAllowed(schedule: ScheduleSettings | undefined): boolean {
  if (!schedule || !schedule.allowedDays || schedule.allowedDays.length === 0) {
    return true; // No day restrictions
  }

  const today = new Date().getDay(); // 0-6, Sunday = 0
  return schedule.allowedDays.includes(today);
}

/**
 * Generate deduplication key from notification and settings
 */
function generateDedupeKey(
  notification: CreateNotification,
  dedupe: DedupeSettings
): string {
  const parts: string[] = [];

  for (const field of dedupe.groupBy) {
    switch (field) {
      case "source":
        parts.push(notification.source);
        break;
      case "category":
        parts.push(notification.category);
        break;
      case "severity":
        parts.push(notification.severity);
        break;
      case "appId":
        parts.push(notification.appId || "");
        break;
      case "environment":
        parts.push(notification.environment || "");
        break;
      case "title":
        parts.push(notification.title);
        break;
      case "sourceEventId":
        parts.push(notification.sourceEventId || "");
        break;
    }
  }

  return parts.join("::");
}

/**
 * Check and update deduplication cache
 * Returns existing notification ID if deduplicated, null if new
 */
function checkDedupe(
  notification: CreateNotification,
  dedupe: DedupeSettings
): { isDuplicate: boolean; existingId?: string; count?: number } {
  if (!dedupe.enabled) {
    return { isDuplicate: false };
  }

  const key = generateDedupeKey(notification, dedupe);
  const now = new Date();
  const entry = dedupeCache.get(key);

  // Clean expired entry
  if (entry && entry.expiresAt < now) {
    dedupeCache.delete(key);
    return { isDuplicate: false };
  }

  if (entry) {
    // Check max group size
    if (dedupe.maxGroupSize && entry.count >= dedupe.maxGroupSize) {
      // Max size reached, create new notification
      dedupeCache.delete(key);
      return { isDuplicate: false };
    }

    // Update existing entry
    entry.count++;
    entry.lastSeen = now;
    return { isDuplicate: true, existingId: entry.notificationId, count: entry.count };
  }

  return { isDuplicate: false };
}

/**
 * Add entry to dedupe cache
 */
function addToDedupeCache(
  notification: CreateNotification,
  notificationId: string,
  dedupe: DedupeSettings
): void {
  if (!dedupe.enabled) return;

  const key = generateDedupeKey(notification, dedupe);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + dedupe.windowMinutes * 60 * 1000);

  dedupeCache.set(key, {
    groupKey: key,
    notificationId,
    count: 1,
    lastSeen: now,
    expiresAt,
  });
}

/**
 * Deliver notification through enabled channels
 */
async function deliverToChannels(
  notification: Notification,
  channels: ChannelConfig[]
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  for (const channelConfig of channels) {
    if (!channelConfig.enabled) continue;

    // Check severity threshold for this channel
    if (!meetsMinSeverity(notification.severity, channelConfig.minSeverity)) {
      continue;
    }

    try {
      let result: DeliveryResult;

      switch (channelConfig.type) {
        case "slack":
          const slackConfig = channelConfig.config as { webhookUrl?: string };
          result = await sendSlackNotification(notification, slackConfig.webhookUrl);
          break;
        case "email":
          const emailConfig = channelConfig.config as { to?: string[]; cc?: string[] };
          if (emailConfig.to && emailConfig.to.length > 0) {
            result = await sendEmailNotification(notification, emailConfig.to);
          } else {
            result = {
              channel: "email",
              success: false,
              error: "No recipients configured",
              timestamp: new Date(),
            };
          }
          break;
        case "push":
          const pushConfig = channelConfig.config as { userId?: string };
          if (pushConfig.userId) {
            result = await sendPushNotification(notification, pushConfig.userId);
          } else {
            result = {
              channel: "push",
              success: false,
              error: "No user ID configured for push",
              timestamp: new Date(),
            };
          }
          break;
        case "in-app":
          // In-app notifications are handled by the notification service itself
          result = {
            channel: "in-app",
            success: true,
            timestamp: new Date(),
          };
          break;
        case "webhook":
          // TODO: Implement generic webhook delivery
          result = {
            channel: "webhook",
            success: false,
            error: "Webhook channel not implemented",
            timestamp: new Date(),
          };
          break;
        default:
          result = {
            channel: channelConfig.type,
            success: false,
            error: `Unknown channel type: ${channelConfig.type}`,
            timestamp: new Date(),
          };
      }

      results.push(result);

      // Record delivery in service
      if (result.success || result.error) {
        await notificationService.recordDelivery(notification.id, result);
      }
    } catch (error) {
      const result: DeliveryResult = {
        channel: channelConfig.type,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
      results.push(result);
      await notificationService.recordDelivery(notification.id, result);
    }
  }

  return results;
}

export class NotificationRulesEngine {
  private rules: NotificationRule[] = [];
  private rulesLoaded = false;

  /**
   * Load or reload rules from database
   */
  async loadRules(): Promise<void> {
    try {
      this.rules = await notificationService.getEnabledRules();
      this.rulesLoaded = true;
      console.log(`Loaded ${this.rules.length} notification rules`);
    } catch (error) {
      console.error("Failed to load notification rules:", error);
      this.rules = [];
    }
  }

  /**
   * Ensure rules are loaded
   */
  private async ensureRulesLoaded(): Promise<void> {
    if (!this.rulesLoaded) {
      await this.loadRules();
    }
  }

  /**
   * Process a notification through the rules engine
   * 
   * @param input The notification to create
   * @returns The created notification and delivery results
   */
  async process(input: CreateNotification): Promise<{
    notification: Notification | null;
    deduplicated: boolean;
    deliveryResults: DeliveryResult[];
    matchedRules: string[];
  }> {
    await this.ensureRulesLoaded();

    const matchedRules: string[] = [];
    let aggregatedChannels: ChannelConfig[] = [];
    let effectiveDedupe: DedupeSettings | undefined;
    let effectiveSchedule: ScheduleSettings | undefined;

    // Find matching rules (sorted by priority, highest first)
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      if (matchesConditions(input, rule.conditions)) {
        matchedRules.push(rule.id);
        
        // Aggregate channels from all matching rules
        aggregatedChannels = [...aggregatedChannels, ...rule.channels];

        // Use highest priority rule's dedupe and schedule settings
        if (!effectiveDedupe && rule.dedupe) {
          effectiveDedupe = rule.dedupe;
        }
        if (!effectiveSchedule && rule.schedule) {
          effectiveSchedule = rule.schedule;
        }
      }
    }

    // If no rules matched, use default behavior (in-app only)
    if (matchedRules.length === 0) {
      aggregatedChannels = [
        { type: "in-app", enabled: true, config: {} },
      ];
    }

    // Check deduplication
    if (effectiveDedupe) {
      const dedupeResult = checkDedupe(input, effectiveDedupe);
      if (dedupeResult.isDuplicate && dedupeResult.existingId) {
        // Update the existing notification's group count
        // (could enhance this to update the message too)
        return {
          notification: null,
          deduplicated: true,
          deliveryResults: [],
          matchedRules,
        };
      }
    }

    // Check schedule/quiet hours
    if (effectiveSchedule) {
      const inQuietHours = isInQuietHours(effectiveSchedule);
      const dayAllowed = isDayAllowed(effectiveSchedule);

      if (inQuietHours || !dayAllowed) {
        // Check if critical notifications should bypass
        if (effectiveSchedule.exceptCritical && input.severity === "critical") {
          // Allow critical through
        } else {
          // Don't deliver, but still create the in-app notification
          aggregatedChannels = aggregatedChannels.filter(
            (c) => c.type === "in-app"
          );
        }
      }
    }

    // Deduplicate channels by type
    const uniqueChannels = new Map<ChannelType, ChannelConfig>();
    for (const channel of aggregatedChannels) {
      if (!uniqueChannels.has(channel.type)) {
        uniqueChannels.set(channel.type, channel);
      }
    }

    // Create the notification
    const notification = await notificationService.create({
      ...input,
      groupKey: effectiveDedupe ? generateDedupeKey(input, effectiveDedupe) : undefined,
    });

    // Add to dedupe cache if enabled
    if (effectiveDedupe) {
      addToDedupeCache(input, notification.id, effectiveDedupe);
    }

    // Deliver to channels
    const deliveryResults = await deliverToChannels(
      notification,
      Array.from(uniqueChannels.values())
    );

    return {
      notification,
      deduplicated: false,
      deliveryResults,
      matchedRules,
    };
  }

  /**
   * Get current rules
   */
  getRules(): NotificationRule[] {
    return this.rules;
  }

  /**
   * Clear dedupe cache (useful for testing)
   */
  clearDedupeCache(): void {
    dedupeCache.clear();
  }

  /**
   * Get dedupe cache stats
   */
  getDedupeCacheStats(): { size: number; entries: string[] } {
    return {
      size: dedupeCache.size,
      entries: Array.from(dedupeCache.keys()),
    };
  }
}

// Singleton instance
export const rulesEngine = new NotificationRulesEngine();

/**
 * Clean up expired dedupe entries periodically
 */
setInterval(() => {
  const now = new Date();
  for (const [key, entry] of dedupeCache.entries()) {
    if (entry.expiresAt < now) {
      dedupeCache.delete(key);
    }
  }
}, 60000); // Every minute
