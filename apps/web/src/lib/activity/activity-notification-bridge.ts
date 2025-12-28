/**
 * Activity-Notification Bridge
 * 
 * Bridges activity events to the notification system, creating notifications
 * for activity events that match certain criteria.
 */

import { ActivityEvent, ActivitySeverity, ActivityCategory } from "./types";
import { activityService } from "./activity-service";
import { rulesEngine } from "@/lib/notifications/rules-engine";
import { NotificationCategory, NotificationSeverity } from "@/lib/notifications/types";

// Map activity categories to notification categories
const CATEGORY_MAP: Record<ActivityCategory, NotificationCategory> = {
  deployment: "deployment",
  security: "security",
  error: "error",
  infrastructure: "infrastructure",
  integration: "integration",
  auth: "auth",
  payment: "payment",
  repository: "deployment", // Map repository to deployment
};

// Map activity severity to notification severity
const SEVERITY_MAP: Record<ActivitySeverity, NotificationSeverity> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "critical",
};

// Minimum severity threshold for creating notifications
const MIN_NOTIFICATION_SEVERITY: NotificationSeverity = "warning";

const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

/**
 * Check if an activity event should trigger a notification
 */
function shouldNotify(event: ActivityEvent): boolean {
  const notificationSeverity = SEVERITY_MAP[event.severity];
  
  // Only notify for warning and above by default
  if (SEVERITY_ORDER[notificationSeverity] < SEVERITY_ORDER[MIN_NOTIFICATION_SEVERITY]) {
    return false;
  }

  // Always notify for certain event types
  const alwaysNotifyTypes = [
    "deployment.failed",
    "deployment.rollback",
    "security.breach",
    "security.access_denied",
    "error.unhandled",
    "error.critical",
    "infrastructure.node_down",
    "infrastructure.service_unhealthy",
    "payment.failed",
    "payment.dispute",
    "auth.suspicious_login",
  ];

  if (alwaysNotifyTypes.includes(event.eventType)) {
    return true;
  }

  return true;
}

/**
 * Convert activity event to notification input
 */
function activityToNotification(event: ActivityEvent) {
  return {
    source: event.source,
    sourceEventId: event.id,
    activityEventId: event.id,
    category: CATEGORY_MAP[event.category] || "infrastructure",
    severity: SEVERITY_MAP[event.severity],
    title: event.title,
    message: event.description || event.title,
    appId: event.appId,
    appName: event.appName,
    environment: event.environment,
    links: event.links,
    metadata: {
      eventType: event.eventType,
      actor: event.actor,
      ...event.metadata,
    },
  };
}

/**
 * Handle activity event and potentially create a notification
 */
async function handleActivityEvent(event: ActivityEvent): Promise<void> {
  try {
    if (!shouldNotify(event)) {
      return;
    }

    const notificationInput = activityToNotification(event);
    
    // Process through rules engine (handles deduplication, routing, etc.)
    const result = await rulesEngine.process(notificationInput);

    if (result.notification) {
      console.log(`Created notification ${result.notification.id} from activity ${event.id}`);
    } else if (result.deduplicated) {
      console.log(`Activity ${event.id} was deduplicated`);
    }
  } catch (error) {
    console.error(`Error creating notification from activity ${event.id}:`, error);
  }
}

let isInitialized = false;

/**
 * Initialize the activity-notification bridge
 * 
 * Subscribes to activity events and creates notifications as needed.
 */
export function initActivityNotificationBridge(): () => void {
  if (isInitialized) {
    console.log("Activity-notification bridge already initialized");
    return () => {};
  }

  console.log("Initializing activity-notification bridge");

  // Subscribe to activity events
  const unsubscribe = activityService.subscribe(handleActivityEvent);
  isInitialized = true;

  return () => {
    unsubscribe();
    isInitialized = false;
  };
}

/**
 * Manually process an activity event for notification
 * Useful for testing or manually triggering notifications
 */
export async function processActivityForNotification(
  event: ActivityEvent
): Promise<void> {
  await handleActivityEvent(event);
}

export { shouldNotify, activityToNotification };
