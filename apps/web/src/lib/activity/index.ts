/**
 * Activity Module Index
 */

export * from "./types";
export { activityService, ActivityService } from "./activity-service";
export { 
  initActivityNotificationBridge, 
  processActivityForNotification,
  shouldNotify,
  activityToNotification,
} from "./activity-notification-bridge";
