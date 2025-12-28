/**
 * Notification System Types
 * 
 * Types for notifications, rules, preferences, and delivery channels
 */

// Notification categories (align with activity categories)
export type NotificationCategory = 
  | 'error' 
  | 'payment' 
  | 'security' 
  | 'infrastructure' 
  | 'deployment' 
  | 'integration'
  | 'auth';

// Severity levels
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

// Notification status
export type NotificationStatus = 'new' | 'seen' | 'acknowledged' | 'resolved' | 'snoozed';

// Delivery channel types
export type ChannelType = 'in-app' | 'slack' | 'email' | 'webhook' | 'push';

/**
 * Notification Action - buttons/links on a notification
 */
export interface NotificationAction {
  id: string;
  label: string;
  type: 'link' | 'api-call' | 'dismiss';
  target?: string;
  variant?: 'default' | 'destructive' | 'outline';
}

/**
 * Notification - the core notification structure
 */
export interface Notification {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Source tracking
  source: string;                    // e.g., "sentry", "stripe", "system"
  sourceEventId?: string;            // Original event ID for deduping
  activityEventId?: string;          // Link to activity feed
  
  // Classification
  category: NotificationCategory;
  severity: NotificationSeverity;
  
  // Content
  title: string;
  message: string;
  
  // Context
  appId?: string;
  appName?: string;
  environment?: string;
  
  // Actions
  actions?: NotificationAction[];
  links?: Array<{ label: string; url: string }>;
  
  // Status
  status: NotificationStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  snoozedUntil?: Date;
  
  // Grouping for deduplication
  groupKey?: string;
  groupCount?: number;
  
  // Delivery tracking
  deliveredVia: ChannelType[];
  
  // User targeting (null = all users)
  userId?: string;
  
  metadata?: Record<string, unknown>;
}

/**
 * Create notification input
 */
export interface CreateNotification {
  source: string;
  sourceEventId?: string;
  activityEventId?: string;
  
  category: NotificationCategory;
  severity: NotificationSeverity;
  
  title: string;
  message: string;
  
  appId?: string;
  appName?: string;
  environment?: string;
  
  actions?: NotificationAction[];
  links?: Array<{ label: string; url: string }>;
  
  groupKey?: string;
  userId?: string;
  
  metadata?: Record<string, unknown>;
}

/**
 * Notification filter options
 */
export interface NotificationFilter {
  sources?: string[];
  categories?: NotificationCategory[];
  severities?: NotificationSeverity[];
  statuses?: NotificationStatus[];
  appIds?: string[];
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Notification query result
 */
export interface NotificationQueryResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
  nextOffset?: number;
}

// ===================================
// Notification Rules
// ===================================

/**
 * Rule conditions for matching events
 */
export interface RuleConditions {
  sources?: string[];
  categories?: NotificationCategory[];
  severities?: NotificationSeverity[];
  appIds?: string[];
  environments?: string[];
  titleContains?: string;
  titleRegex?: string;
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
  type: ChannelType;
  enabled: boolean;
  minSeverity?: NotificationSeverity;
  config: Record<string, unknown>;   // Channel-specific config
}

/**
 * Deduplication settings
 */
export interface DedupeSettings {
  enabled: boolean;
  windowMinutes: number;
  groupBy: string[];                 // Fields to group by
  maxGroupSize?: number;
}

/**
 * Schedule settings (quiet hours)
 */
export interface ScheduleSettings {
  quietHoursEnabled: boolean;
  quietHoursStart?: string;          // "22:00"
  quietHoursEnd?: string;            // "08:00"
  quietHoursTimezone?: string;
  allowedDays?: number[];            // 0-6, Sunday = 0
  exceptCritical?: boolean;          // Allow critical through quiet hours
}

/**
 * Notification Rule
 */
export interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;                  // Higher = evaluated first
  
  // Matching
  conditions: RuleConditions;
  
  // Actions
  channels: ChannelConfig[];
  
  // Behavior
  dedupe?: DedupeSettings;
  schedule?: ScheduleSettings;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Create rule input
 */
export interface CreateNotificationRule {
  name: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  conditions: RuleConditions;
  channels: ChannelConfig[];
  dedupe?: DedupeSettings;
  schedule?: ScheduleSettings;
}

// ===================================
// User Preferences
// ===================================

/**
 * Per-category preference
 */
export interface CategoryPreference {
  enabled: boolean;
  channels: ChannelType[];
  minSeverity: NotificationSeverity;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  id: string;
  userId: string;
  
  // Global toggles
  emailEnabled: boolean;
  slackEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  
  // Per-category settings
  categoryPreferences: Record<NotificationCategory, CategoryPreference>;
  
  // Quiet hours
  quietHours?: {
    enabled: boolean;
    start: string;                   // "22:00"
    end: string;                     // "08:00"
    timezone: string;
    exceptCritical: boolean;
  };
  
  // Digest settings
  emailDigest?: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time?: string;                   // For daily/weekly
  };
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Update preferences input
 */
export interface UpdateNotificationPreferences {
  emailEnabled?: boolean;
  slackEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  categoryPreferences?: Partial<Record<NotificationCategory, CategoryPreference>>;
  quietHours?: NotificationPreferences['quietHours'];
  emailDigest?: NotificationPreferences['emailDigest'];
}

// ===================================
// Push Subscriptions
// ===================================

/**
 * Push subscription for mobile/web push
 */
export interface PushSubscription {
  id: string;
  userId: string;
  
  // Device info
  deviceId: string;
  deviceName?: string;
  platform: 'ios' | 'android' | 'web';
  
  // Push token
  pushToken: string;
  
  // Status
  active: boolean;
  lastUsedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// ===================================
// Delivery Types
// ===================================

/**
 * Slack message format
 */
export interface SlackMessage {
  channel?: string;
  text: string;
  blocks?: unknown[];
  attachments?: unknown[];
}

/**
 * Email message format
 */
export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Push message format
 */
export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

/**
 * Delivery result
 */
export interface DeliveryResult {
  channel: ChannelType;
  success: boolean;
  error?: string;
  messageId?: string;
  timestamp: Date;
}

// ===================================
// Stats
// ===================================

/**
 * Notification statistics
 */
export interface NotificationStats {
  total: number;
  unread: number;
  byStatus: Record<NotificationStatus, number>;
  bySeverity: Record<NotificationSeverity, number>;
  byCategory: Record<NotificationCategory, number>;
  last24h: number;
  last7d: number;
}
