"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";
import { Notification } from "@/lib/notifications/types";

interface NotificationBellProps {
  userId?: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial notifications and stats
  const fetchNotifications = useCallback(async () => {
    try {
      // Fetch recent notifications
      const params = new URLSearchParams({
        limit: "10",
        statuses: "new,seen",
      });
      if (userId) {
        params.set("userId", userId);
      }

      const response = await fetch(`/api/notifications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Set up SSE connection for real-time updates
  useEffect(() => {
    fetchNotifications();

    // Set up SSE
    const params = new URLSearchParams();
    if (userId) {
      params.set("userId", userId);
    }
    
    const eventSource = new EventSource(`/api/notifications/stream?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          const newNotification = {
            ...data.notification,
            createdAt: new Date(data.notification.createdAt),
            updatedAt: new Date(data.notification.updatedAt),
          };
          setNotifications((prev) => [newNotification, ...prev.slice(0, 9)]);
          setUnreadCount((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection error");
      eventSource.close();
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          fetchNotifications();
        }
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [userId, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read", userId }),
      });

      if (response.ok) {
        setUnreadCount(0);
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, status: "seen" as const }))
        );
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged", userId }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: "acknowledged" as const } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error acknowledging notification:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          loading={loading}
          unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllRead}
          onAcknowledge={handleAcknowledge}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default NotificationBell;
