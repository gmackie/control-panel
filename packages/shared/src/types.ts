/**
 * Shared Types
 * 
 * Core types used across web and mobile apps
 */

// ===================================
// Common Types
// ===================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ===================================
// Activity Types
// ===================================

export type ActivitySource = 
  | "gitea" 
  | "clerk" 
  | "stripe" 
  | "sentry" 
  | "posthog" 
  | "kubernetes" 
  | "neon"
  | "system";

export type ActivityCategory = 
  | "deployment" 
  | "auth" 
  | "payment" 
  | "error" 
  | "infrastructure" 
  | "integration" 
  | "security"
  | "repository";

export type ActivitySeverity = "info" | "warning" | "error" | "critical";

export interface ActivityEvent {
  id: string;
  timestamp: Date;
  source: ActivitySource;
  category: ActivityCategory;
  eventType: string;
  severity: ActivitySeverity;
  appId?: string;
  appName?: string;
  environment?: string;
  title: string;
  description?: string;
  actor?: {
    type: "user" | "system" | "webhook" | "automation";
    id?: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
  links?: Array<{ label: string; url: string }>;
  metadata?: Record<string, unknown>;
}

// ===================================
// Notification Types
// ===================================

export type NotificationCategory = 
  | "error" 
  | "payment" 
  | "security" 
  | "infrastructure" 
  | "deployment" 
  | "integration"
  | "auth";

export type NotificationSeverity = "info" | "warning" | "error" | "critical";

export type NotificationStatus = "new" | "seen" | "acknowledged" | "resolved" | "snoozed";

export type ChannelType = "in-app" | "slack" | "email" | "webhook" | "push";

export interface NotificationAction {
  id: string;
  label: string;
  type: "link" | "api-call" | "dismiss";
  target?: string;
  variant?: "default" | "destructive" | "outline";
}

export interface Notification {
  id: string;
  createdAt: Date;
  updatedAt: Date;
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
  status: NotificationStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  snoozedUntil?: Date;
  groupKey?: string;
  groupCount?: number;
  deliveredVia: ChannelType[];
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byStatus: Record<NotificationStatus, number>;
  bySeverity: Record<NotificationSeverity, number>;
  byCategory: Record<NotificationCategory, number>;
  last24h: number;
  last7d: number;
}

// ===================================
// Application Types
// ===================================

export interface Application {
  id: string;
  name: string;
  slug: string;
  description?: string;
  repositoryUrl?: string;
  status: "active" | "inactive" | "deploying" | "failed";
  environments: ApplicationEnvironment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationEnvironment {
  id: string;
  name: string;
  url?: string;
  status: "healthy" | "unhealthy" | "unknown";
  lastDeployedAt?: Date;
}

// ===================================
// Cluster Types
// ===================================

export interface ClusterNode {
  id: string;
  name: string;
  status: "ready" | "not-ready" | "unknown";
  role: "master" | "worker";
  ip: string;
  cpu: ResourceUsage;
  memory: ResourceUsage;
  pods: number;
}

export interface ResourceUsage {
  used: number;
  total: number;
  unit: string;
}

// ===================================
// User Types
// ===================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: "admin" | "user" | "viewer";
  createdAt: Date;
}
