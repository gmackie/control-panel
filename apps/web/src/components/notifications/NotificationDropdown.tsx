"use client";

import Link from "next/link";
import { Settings, CheckCheck, Loader2 } from "lucide-react";
import { NotificationCard } from "./NotificationCard";
import { Notification } from "@/lib/notifications/types";

interface NotificationDropdownProps {
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;
  onMarkAllRead: () => void;
  onAcknowledge: (id: string) => void;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  loading,
  unreadCount,
  onMarkAllRead,
  onAcknowledge,
  onClose,
}: NotificationDropdownProps) {
  return (
    <div className="absolute right-0 mt-2 w-96 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-100">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <Link
            href="/settings/notifications"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No notifications</p>
            <p className="text-xs text-gray-500 mt-1">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-2">
                <NotificationCard
                  notification={notification}
                  compact
                  onAcknowledge={onAcknowledge}
                  onClick={() => {
                    // Navigate to notification detail or mark as seen
                    onAcknowledge(notification.id);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800 text-center">
        <Link
          href="/notifications"
          onClick={onClose}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}

export default NotificationDropdown;
