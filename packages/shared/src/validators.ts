/**
 * Shared Validators
 * 
 * Zod schemas and validation utilities
 */

// Note: We're using simple validation functions here
// In a full implementation, you'd use Zod schemas

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isNotEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate notification severity
 */
export function isValidSeverity(severity: string): severity is "info" | "warning" | "error" | "critical" {
  return ["info", "warning", "error", "critical"].includes(severity);
}

/**
 * Validate notification status
 */
export function isValidNotificationStatus(status: string): status is "new" | "seen" | "acknowledged" | "resolved" | "snoozed" {
  return ["new", "seen", "acknowledged", "resolved", "snoozed"].includes(status);
}

/**
 * Validate notification category
 */
export function isValidNotificationCategory(category: string): category is "error" | "payment" | "security" | "infrastructure" | "deployment" | "integration" | "auth" {
  return ["error", "payment", "security", "infrastructure", "deployment", "integration", "auth"].includes(category);
}
