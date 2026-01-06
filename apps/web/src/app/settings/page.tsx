"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Bell,
  Key,
  Network,
  Palette,
  User,
  Save,
  Loader2,
  Copy,
  Trash2,
  Plus,
  ExternalLink,
  Check,
  Github,
  MessageSquare,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const MOCK_API_KEYS = [
  {
    id: "1",
    name: "Production API Key",
    prefix: "cp_live_",
    createdAt: "2024-12-15",
    lastUsed: "2024-12-28",
  },
  {
    id: "2",
    name: "Development Key",
    prefix: "cp_dev_",
    createdAt: "2024-11-20",
    lastUsed: "2024-12-27",
  },
  {
    id: "3",
    name: "CI/CD Pipeline",
    prefix: "cp_ci_",
    createdAt: "2024-10-05",
    lastUsed: "2024-12-28",
  },
];

const INTEGRATIONS = [
  {
    id: "github",
    name: "GitHub",
    description: "Repository access and webhooks",
    icon: Github,
    connected: true,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Notifications and alerts",
    icon: MessageSquare,
    connected: true,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing",
    icon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
      </svg>
    ),
    connected: true,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "clerk",
    name: "Clerk",
    description: "Authentication service",
    icon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5a3 3 0 110 6 3 3 0 010-6zm0 14.25c-3.038 0-5.625-1.875-5.625-4.125 0-1.5 1.125-2.625 2.625-2.625h6c1.5 0 2.625 1.125 2.625 2.625 0 2.25-2.587 4.125-5.625 4.125z" />
      </svg>
    ),
    connected: false,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
];

type ThemePreference = "system" | "light" | "dark";

interface GeneralSettings {
  displayName: string;
  email: string;
  timezone: string;
  theme: ThemePreference;
}

interface AppearanceSettings {
  theme: ThemePreference;
  compactMode: boolean;
  showApplications: boolean;
  showClusters: boolean;
  showIntegrations: boolean;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    displayName: "Admin User",
    email: "admin@gmac.io",
    timezone: "America/New_York",
    theme: "system",
  });

  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    theme: "system",
    compactMode: false,
    showApplications: true,
    showClusters: true,
    showIntegrations: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCopyKey = (keyId: string) => {
    navigator.clipboard.writeText(`${keyId}_xxxxxxxxxxxx`);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="w-32 h-6 mb-2" />
              <Skeleton className="w-48 h-4" />
            </div>
          </div>
          <Skeleton className="w-full h-10 mb-6" />
          <div className="space-y-4">
            <Skeleton className="w-full h-32" />
            <Skeleton className="w-full h-32" />
            <Skeleton className="w-full h-32" />
          </div>
        </div>
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
              <Settings className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-gray-400">
                Manage your account and application preferences
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className={saved ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : ""}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-gray-900 border border-gray-800 p-1 w-full justify-start">
            <TabsTrigger
              value="general"
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-gray-100"
            >
              <User className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-gray-100"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger
              value="api-keys"
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-gray-100"
            >
              <Key className="w-4 h-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger
              value="integrations"
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-gray-100"
            >
              <Network className="w-4 h-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-gray-100"
            >
              <Palette className="w-4 h-4 mr-2" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-100">Profile Settings</CardTitle>
                <CardDescription>
                  Manage your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={generalSettings.displayName}
                    onChange={(e) =>
                      setGeneralSettings((prev) => ({
                        ...prev,
                        displayName: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={generalSettings.email}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email is managed through your authentication provider
                  </p>
                </div>

                {/* Theme Preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Theme Preference
                  </label>
                  <div className="flex gap-2">
                    {(["system", "light", "dark"] as ThemePreference[]).map((theme) => (
                      <button
                        key={theme}
                        onClick={() =>
                          setGeneralSettings((prev) => ({ ...prev, theme }))
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          generalSettings.theme === theme
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"
                        }`}
                      >
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={generalSettings.timezone}
                    onChange={(e) =>
                      setGeneralSettings((prev) => ({
                        ...prev,
                        timezone: e.target.value,
                      }))
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-100">Notification Settings</CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Bell className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-100">
                        Notification Preferences
                      </h3>
                      <p className="text-sm text-gray-400">
                        Manage channels, categories, and quiet hours
                      </p>
                    </div>
                  </div>
                  <Link href="/settings/notifications">
                    <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-gray-100">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Manage Notification Preferences
                    </Button>
                  </Link>
                </div>

                <div className="text-sm text-gray-400">
                  <p>Current configuration:</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Email notifications enabled</li>
                    <li>Slack notifications enabled</li>
                    <li>In-app notifications enabled</li>
                    <li>Quiet hours: 10:00 PM - 8:00 AM</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-gray-100">API Keys</CardTitle>
                  <CardDescription>
                    Manage API keys for programmatic access
                  </CardDescription>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New API Key
                </Button>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-800">
                  {MOCK_API_KEYS.map((apiKey) => (
                    <div
                      key={apiKey.id}
                      className="flex items-center justify-between py-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-100">
                            {apiKey.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {apiKey.prefix}***
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span>Created: {apiKey.createdAt}</span>
                          <span>Last used: {apiKey.lastUsed}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyKey(apiKey.id)}
                          className="text-gray-400 hover:text-gray-100"
                        >
                          {copiedKeyId === apiKey.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations">
            <Card className="bg-gray-900/50 border-gray-800 mb-6">
              <CardHeader>
                <CardTitle className="text-gray-100">Organization Integrations</CardTitle>
                <CardDescription>
                  Connect organization-wide accounts for Vercel, Expo, Neon, and other services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/integrations/hub">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Network className="w-4 h-4 mr-2" />
                    Manage Organization Integrations
                  </Button>
                </Link>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-100">Quick Integrations</CardTitle>
                <CardDescription>
                  Connect third-party services to enhance your workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {INTEGRATIONS.map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <div
                        key={integration.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${integration.bgColor} rounded-lg`}>
                            <Icon className={`w-5 h-5 ${integration.color}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-100">
                                {integration.name}
                              </h3>
                              <Badge
                                variant={integration.connected ? "success" : "secondary"}
                              >
                                {integration.connected ? "Connected" : "Not Connected"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-400">
                              {integration.description}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-700 text-gray-300 hover:text-gray-100"
                        >
                          Configure
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-100">Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel of the dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Selector with Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {(["system", "light", "dark"] as ThemePreference[]).map((theme) => (
                      <button
                        key={theme}
                        onClick={() =>
                          setAppearanceSettings((prev) => ({ ...prev, theme }))
                        }
                        className={`relative p-3 rounded-lg border transition-all ${
                          appearanceSettings.theme === theme
                            ? "border-blue-500 ring-2 ring-blue-500/20"
                            : "border-gray-700 hover:border-gray-600"
                        }`}
                      >
                        {/* Theme Preview */}
                        <div
                          className={`h-16 rounded mb-2 ${
                            theme === "dark"
                              ? "bg-gray-950"
                              : theme === "light"
                              ? "bg-white"
                              : "bg-gradient-to-r from-gray-950 to-white"
                          }`}
                        >
                          <div
                            className={`h-full p-2 flex flex-col gap-1 ${
                              theme === "light" ? "text-gray-900" : ""
                            }`}
                          >
                            <div
                              className={`h-2 w-8 rounded ${
                                theme === "light" ? "bg-gray-300" : "bg-gray-700"
                              }`}
                            />
                            <div
                              className={`h-2 w-12 rounded ${
                                theme === "light" ? "bg-gray-200" : "bg-gray-800"
                              }`}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-300">
                          {theme.charAt(0).toUpperCase() + theme.slice(1)}
                        </span>
                        {appearanceSettings.theme === theme && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-4 h-4 text-blue-400" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact Mode */}
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div>
                    <h3 className="font-medium text-gray-100">Compact Mode</h3>
                    <p className="text-sm text-gray-400">
                      Reduce spacing and use smaller elements
                    </p>
                  </div>
                  <Switch
                    checked={appearanceSettings.compactMode}
                    onCheckedChange={(checked) =>
                      setAppearanceSettings((prev) => ({
                        ...prev,
                        compactMode: checked,
                      }))
                    }
                  />
                </div>

                {/* Sidebar Sections */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Sidebar Sections
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <span className="text-gray-100">Applications</span>
                      <Switch
                        checked={appearanceSettings.showApplications}
                        onCheckedChange={(checked) =>
                          setAppearanceSettings((prev) => ({
                            ...prev,
                            showApplications: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <span className="text-gray-100">Clusters</span>
                      <Switch
                        checked={appearanceSettings.showClusters}
                        onCheckedChange={(checked) =>
                          setAppearanceSettings((prev) => ({
                            ...prev,
                            showClusters: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <span className="text-gray-100">Integrations</span>
                      <Switch
                        checked={appearanceSettings.showIntegrations}
                        onCheckedChange={(checked) =>
                          setAppearanceSettings((prev) => ({
                            ...prev,
                            showIntegrations: checked,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
