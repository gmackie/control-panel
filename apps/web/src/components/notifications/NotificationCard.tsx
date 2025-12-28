"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  AlertOctagon,
  Check,
  Clock,
  ExternalLink,
  Eye,
} from "lucide-react";
import { Notification, NotificationSeverity, NotificationStatus } from "@/lib/notifications/types";

interface NotificationCardProps {
  notification: Notification;
  compact?: boolean;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  onSnooze?: (id: string, until: Date) => void;
  onClick?: (notification: Notification) => void;
}

const severityConfig: Record<NotificationSeverity, { icon: typeof Info; color: string; bgColor: string }> = {
  info: {
    icon: Info,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  critical: {
    icon: AlertOctagon,
    color: "text-red-500",
    bgColor: "bg-red-600/10",
  },
};

const statusConfig: Record<NotificationStatus, { label: string; color: string }> = {
  new: { label: "New", color: "text-blue-400" },
  seen: { label: "Seen", color: "text-gray-400" },
  acknowledged: { label: "Acknowledged", color: "text-yellow-400" },
  resolved: { label: "Resolved", color: "text-green-400" },
  snoozed: { label: "Snoozed", color: "text-purple-400" },
};

export function NotificationCard({
  notification,
  compact = false,
  onAcknowledge,
  onResolve,
  onSnooze,
  onClick,
}: NotificationCardProps) {
  const severity = severityConfig[notification.severity];
  const status = statusConfig[notification.status];
  const SeverityIcon = severity.icon;

  const isUnread = notification.status === "new";

  const handleSnooze = () => {
    if (onSnooze) {
      // Snooze for 1 hour
      const until = new Date(Date.now() + 60 * 60 * 1000);
      onSnooze(notification.id, until);
    }
  };

  if (compact) {
    return (
      <div
        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
          isUnread ? "bg-gray-800/50" : "bg-gray-900/30"
        } hover:bg-gray-800`}
        onClick={() => onClick?.(notification)}
      >
        <div className={`p-1.5 rounded ${severity.bgColor}`}>
          <SeverityIcon className={`w-4 h-4 ${severity.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isUnread ? "text-gray-100" : "text-gray-300"}`}>
              {notification.title}
            </span>
            {isUnread && (
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{notification.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
            </span>
            {notification.appName && (
              <span className="text-xs text-gray-600">
                {notification.appName}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        isUnread
          ? "bg-gray-800/50 border-gray-700"
          : "bg-gray-900/30 border-gray-800"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${severity.bgColor}`}>
          <SeverityIcon className={`w-5 h-5 ${severity.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className={`font-medium ${isUnread ? "text-gray-100" : "text-gray-300"}`}>
                  {notification.title}
                </h4>
                {isUnread && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
            </div>
            <span className={`text-xs ${status.color}`}>{status.label}</span>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
            <span>{notification.source}</span>
            <span className="text-gray-700">|</span>
            <span className="capitalize">{notification.category}</span>
            {notification.appName && (
              <>
                <span className="text-gray-700">|</span>
                <span>{notification.appName}</span>
              </>
            )}
            {notification.environment && (
              <>
                <span className="text-gray-700">|</span>
                <span className="capitalize">{notification.environment}</span>
              </>
            )}
            <span className="text-gray-700">|</span>
            <span>{formatDistanceToNow(notification.createdAt, { addSuffix: true })}</span>
          </div>

          {/* Links */}
          {notification.links && notification.links.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {notification.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-400 bg-blue-500/10 rounded hover:bg-blue-500/20 transition-colors"
                >
                  {link.label}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          {(onAcknowledge || onResolve || onSnooze) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
              {notification.status === "new" && onAcknowledge && (
                <button
                  onClick={() => onAcknowledge(notification.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  Acknowledge
                </button>
              )}
              {onResolve && (notification.status as string) !== "resolved" && (
                <button
                  onClick={() => onResolve(notification.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Resolve
                </button>
              )}
              {onSnooze && notification.status !== "snoozed" && (
                <button
                  onClick={handleSnooze}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  Snooze 1h
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationCard;
