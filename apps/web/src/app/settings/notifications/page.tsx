"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Moon,
  Save,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { NotificationCategory, NotificationSeverity } from "@/lib/notifications/types";

interface CategoryPreference {
  enabled: boolean;
  channels: string[];
  minSeverity: NotificationSeverity;
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  exceptCritical: boolean;
}

interface Preferences {
  emailEnabled: boolean;
  slackEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  categoryPreferences: Record<string, CategoryPreference>;
  quietHours?: QuietHours;
}

const CATEGORIES: { value: NotificationCategory; label: string; description: string }[] = [
  { value: "error", label: "Errors", description: "Application errors and exceptions" },
  { value: "payment", label: "Payments", description: "Payment events from Stripe" },
  { value: "security", label: "Security", description: "Security alerts and access events" },
  { value: "infrastructure", label: "Infrastructure", description: "Cluster and node events" },
  { value: "deployment", label: "Deployments", description: "CI/CD and deployment events" },
  { value: "integration", label: "Integrations", description: "Third-party service events" },
  { value: "auth", label: "Authentication", description: "User authentication events" },
];

const SEVERITIES: { value: NotificationSeverity; label: string; icon: typeof Info }[] = [
  { value: "info", label: "Info", icon: Info },
  { value: "warning", label: "Warning", icon: AlertTriangle },
  { value: "error", label: "Error", icon: AlertCircle },
  { value: "critical", label: "Critical", icon: AlertOctagon },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
];

const DEFAULT_PREFERENCES: Preferences = {
  emailEnabled: true,
  slackEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  categoryPreferences: {},
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
    timezone: "UTC",
    exceptCritical: true,
  },
};

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const fetchPreferences = useCallback(async () => {
    try {
      // In a real app, this would fetch user-specific preferences
      // For now, we'll use defaults
      setLoading(false);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // In a real app, this would save to the API
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "current-user", // Would be the actual user ID
          ...preferences,
        }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (channel: keyof Pick<Preferences, 'emailEnabled' | 'slackEnabled' | 'pushEnabled' | 'inAppEnabled'>) => {
    setPreferences((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const updateCategoryPreference = (
    category: string,
    updates: Partial<CategoryPreference>
  ) => {
    setPreferences((prev) => ({
      ...prev,
      categoryPreferences: {
        ...prev.categoryPreferences,
        [category]: {
          ...getCategoryPreference(category),
          ...updates,
        },
      },
    }));
  };

  const getCategoryPreference = (category: string): CategoryPreference => {
    return (
      preferences.categoryPreferences[category] || {
        enabled: true,
        channels: ["in-app", "email"],
        minSeverity: "warning" as NotificationSeverity,
      }
    );
  };

  const updateQuietHours = (updates: Partial<QuietHours>) => {
    setPreferences((prev) => ({
      ...prev,
      quietHours: {
        ...prev.quietHours!,
        ...updates,
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Bell className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notification Preferences</h1>
              <p className="text-sm text-gray-400">
                Customize how and when you receive notifications
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              saved
                ? "bg-green-500/20 text-green-400"
                : "bg-blue-600 text-white hover:bg-blue-700"
            } disabled:opacity-50`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>Saved!</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Channels Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Notification Channels</h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg divide-y divide-gray-800">
            {/* In-App */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Bell className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium">In-App Notifications</h3>
                  <p className="text-sm text-gray-400">
                    Notifications in the dashboard header
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleChannel("inAppEnabled")}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.inAppEnabled ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    preferences.inAppEnabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Mail className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium">Email Notifications</h3>
                  <p className="text-sm text-gray-400">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleChannel("emailEnabled")}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.emailEnabled ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    preferences.emailEnabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Slack */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium">Slack Notifications</h3>
                  <p className="text-sm text-gray-400">
                    Receive notifications in Slack
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleChannel("slackEnabled")}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.slackEnabled ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    preferences.slackEnabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Push */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Smartphone className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-medium">Push Notifications</h3>
                  <p className="text-sm text-gray-400">
                    Mobile push notifications (requires app)
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleChannel("pushEnabled")}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.pushEnabled ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    preferences.pushEnabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Notification Categories</h2>
          <p className="text-sm text-gray-400 mb-4">
            Configure notifications for each category
          </p>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg divide-y divide-gray-800">
            {CATEGORIES.map((category) => {
              const pref = getCategoryPreference(category.value);
              const isExpanded = expandedCategories.has(category.value);

              return (
                <div key={category.value}>
                  <button
                    onClick={() => toggleCategory(category.value)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={pref.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateCategoryPreference(category.value, {
                            enabled: !pref.enabled,
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                      />
                      <div className="text-left">
                        <h3 className="font-medium">{category.label}</h3>
                        <p className="text-sm text-gray-400">{category.description}</p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-800/30">
                      <div className="ml-7 space-y-4">
                        {/* Minimum Severity */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            Minimum Severity
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {SEVERITIES.map((severity) => {
                              const Icon = severity.icon;
                              return (
                                <button
                                  key={severity.value}
                                  onClick={() =>
                                    updateCategoryPreference(category.value, {
                                      minSeverity: severity.value,
                                    })
                                  }
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    pref.minSeverity === severity.value
                                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {severity.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Channels for this category */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            Deliver via
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "in-app", label: "In-App", icon: Bell },
                              { value: "email", label: "Email", icon: Mail },
                              { value: "slack", label: "Slack", icon: MessageSquare },
                              { value: "push", label: "Push", icon: Smartphone },
                            ].map((channel) => {
                              const Icon = channel.icon;
                              const isSelected = pref.channels.includes(channel.value);
                              return (
                                <button
                                  key={channel.value}
                                  onClick={() => {
                                    const newChannels = isSelected
                                      ? pref.channels.filter((c) => c !== channel.value)
                                      : [...pref.channels, channel.value];
                                    updateCategoryPreference(category.value, {
                                      channels: newChannels,
                                    });
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    isSelected
                                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {channel.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Quiet Hours Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Quiet Hours</h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Moon className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium">Enable Quiet Hours</h3>
                  <p className="text-sm text-gray-400">
                    Pause non-critical notifications during set hours
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  updateQuietHours({ enabled: !preferences.quietHours?.enabled })
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.quietHours?.enabled ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    preferences.quietHours?.enabled
                      ? "translate-x-7"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {preferences.quietHours?.enabled && (
              <div className="ml-11 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) =>
                        updateQuietHours({ start: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) => updateQuietHours({ end: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Timezone
                  </label>
                  <select
                    value={preferences.quietHours.timezone}
                    onChange={(e) =>
                      updateQuietHours({ timezone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="exceptCritical"
                    checked={preferences.quietHours.exceptCritical}
                    onChange={(e) =>
                      updateQuietHours({ exceptCritical: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                  <label
                    htmlFor="exceptCritical"
                    className="text-sm text-gray-300"
                  >
                    Allow critical notifications during quiet hours
                  </label>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
