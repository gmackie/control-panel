/**
 * Notifications Module Index
 * 
 * Exports all notification-related services and types
 */

// Types
export * from "./types";

// Service
export { notificationService, NotificationService } from "./notification-service";

// Rules Engine
export { rulesEngine, NotificationRulesEngine } from "./rules-engine";

// Channels
export {
  sendSlackNotification,
  testSlackConnection,
  sendEmailNotification,
  testEmailConnection,
  sendPushNotification,
  sendPushToUsers,
  registerPushSubscription,
  unregisterPushSubscription,
  getUserPushSubscriptions,
} from "./channels";
