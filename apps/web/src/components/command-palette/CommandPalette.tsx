"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Command,
  ArrowRight,
  Code,
  Server,
  Rocket,
  GitBranch,
  Database,
  Shield,
  Activity,
  AlertTriangle,
  Settings,
  BarChart3,
  Zap,
  Box,
  Globe,
  RefreshCw,
  Plus,
  Eye,
  PlayCircle,
  Clock,
  CreditCard,
  Users,
  FileText,
  Terminal,
  Container,
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  category: "navigation" | "applications" | "actions" | "services" | "recent";
  action: () => void;
  keywords?: string[];
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch applications for search
  const { data: appsData } = useQuery({
    queryKey: ["command-palette-apps"],
    queryFn: async () => {
      const response = await fetch("/api/applications");
      if (!response.ok) return [];
      const data = await response.json();
      return data.applications || [];
    },
    enabled: open,
    staleTime: 30000,
  });

  // Fetch services for search
  const { data: servicesData } = useQuery({
    queryKey: ["command-palette-services"],
    queryFn: async () => {
      const response = await fetch("/api/services");
      if (!response.ok) return [];
      const data = await response.json();
      return data.services || [];
    },
    enabled: open,
    staleTime: 30000,
  });

  const allCommands = useMemo(() => {
    const applications = appsData || [];
    const services = servicesData || [];
    const navigationCommands: CommandItem[] = [
      {
        id: "nav-dashboard",
        title: "Dashboard",
        description: "Go to main dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        category: "navigation",
        action: () => router.push("/"),
      keywords: ["home", "overview", "main"],
      shortcut: "G D",
    },
    {
      id: "nav-applications",
      title: "Applications",
      description: "View all applications",
      icon: <Code className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/applications"),
      keywords: ["apps", "projects"],
      shortcut: "G A",
    },
    {
      id: "nav-deployments",
      title: "Deployments",
      description: "View deployment history",
      icon: <Rocket className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/deployments"),
      keywords: ["deploys", "releases"],
      shortcut: "G P",
    },
    {
      id: "nav-cluster",
      title: "Cluster",
      description: "Kubernetes cluster management",
      icon: <Server className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/cluster"),
      keywords: ["k8s", "kubernetes", "nodes", "pods"],
      shortcut: "G C",
    },
    {
      id: "nav-services",
      title: "Services",
      description: "View all services",
      icon: <Box className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/services"),
      keywords: ["microservices"],
    },
    {
      id: "nav-resources",
      title: "Resources",
      description: "View infrastructure resources",
      icon: <Database className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/resources"),
      keywords: ["pods", "nodes", "ingress", "repos"],
    },
    {
      id: "nav-registry",
      title: "Registry",
      description: "Container image registry",
      icon: <Container className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/registry"),
      keywords: ["docker", "images", "harbor"],
    },
    {
      id: "nav-cicd",
      title: "CI/CD Pipelines",
      description: "View build pipelines",
      icon: <GitBranch className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/cicd"),
      keywords: ["builds", "pipelines", "github", "gitea"],
    },
    {
      id: "nav-monitoring",
      title: "Monitoring",
      description: "Application monitoring",
      icon: <Activity className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/monitoring"),
      keywords: ["metrics", "logs", "traces"],
    },
    {
      id: "nav-alerts",
      title: "Alerts",
      description: "View and manage alerts",
      icon: <AlertTriangle className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/alerts"),
      keywords: ["notifications", "incidents"],
    },
    {
      id: "nav-health",
      title: "Health",
      description: "System health and SLOs",
      icon: <Shield className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/health"),
      keywords: ["slo", "uptime", "status"],
    },
    {
      id: "nav-costs",
      title: "Costs",
      description: "Cost tracking and budgets",
      icon: <CreditCard className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/costs"),
      keywords: ["billing", "budget", "spending"],
    },
    {
      id: "nav-integrations",
      title: "Integrations",
      description: "Third-party integrations",
      icon: <Zap className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/integrations"),
      keywords: ["stripe", "clerk", "sentry", "posthog"],
    },
    {
      id: "nav-secrets",
      title: "Secrets",
      description: "Manage secrets",
      icon: <Shield className="h-4 w-4" />,
      category: "navigation",
      action: () => router.push("/secrets"),
      keywords: ["env", "environment", "keys", "tokens"],
    },
  ];

    const actionCommands: CommandItem[] = [
    {
      id: "action-create-app",
      title: "Create Application",
      description: "Create a new application",
      icon: <Plus className="h-4 w-4" />,
      category: "actions",
      action: () => router.push("/applications?action=create"),
      keywords: ["new", "add"],
    },
    {
      id: "action-deploy",
      title: "Quick Deploy",
      description: "Deploy an application",
      icon: <Rocket className="h-4 w-4" />,
      category: "actions",
      action: () => router.push("/deployments?action=new"),
      keywords: ["release", "push"],
    },
    {
      id: "action-create-secret",
      title: "Create Secret",
      description: "Add a new secret",
      icon: <Shield className="h-4 w-4" />,
      category: "actions",
      action: () => router.push("/secrets?action=create"),
      keywords: ["env", "environment"],
    },
    {
      id: "action-view-logs",
      title: "View Logs",
      description: "View application logs",
      icon: <Terminal className="h-4 w-4" />,
      category: "actions",
      action: () => router.push("/monitoring?tab=logs"),
      keywords: ["debug", "output"],
    },
    {
      id: "action-refresh-status",
      title: "Refresh Status",
      description: "Refresh system status",
      icon: <RefreshCw className="h-4 w-4" />,
      category: "actions",
      action: () => window.location.reload(),
      keywords: ["reload", "update"],
    },
  ];

    const applicationCommands: CommandItem[] = applications.map((app: any) => ({
    id: `app-${app.id || app.slug}`,
    title: app.name,
    description: app.description || `View ${app.name} application`,
    icon: <Code className="h-4 w-4" />,
    category: "applications" as const,
    action: () => router.push(`/applications/${app.slug || app.id}`),
    keywords: [app.slug, app.language, app.framework].filter(Boolean),
  }));

    const serviceCommands: CommandItem[] = services.map((service: any) => ({
    id: `service-${service.id || service.name}`,
    title: service.name,
    description: `${service.type || "Service"} - ${service.status || "unknown"}`,
    icon: <Box className="h-4 w-4" />,
    category: "services" as const,
    action: () => router.push(`/services/${service.id}`),
      keywords: [service.type, service.status].filter(Boolean),
    }));

    return [
      ...navigationCommands,
      ...actionCommands,
      ...applicationCommands,
      ...serviceCommands,
    ];
  }, [appsData, servicesData, router]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      // Show navigation and actions by default
      return allCommands.filter(cmd => 
        cmd.category === "navigation" || cmd.category === "actions"
      ).slice(0, 12);
    }

    const searchLower = search.toLowerCase();
    return allCommands.filter(cmd => {
      const titleMatch = cmd.title.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      return titleMatch || descMatch || keywordMatch;
    }).slice(0, 15);
  }, [search, allCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    navigation: "Navigation",
    applications: "Applications",
    actions: "Quick Actions",
    services: "Services",
    recent: "Recent",
  };

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onOpenChange(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  }, [filteredCommands, selectedIndex, onOpenChange]);

  const executeCommand = (cmd: CommandItem) => {
    cmd.action();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b border-gray-800 px-4">
          <Search className="h-5 w-5 text-gray-400 mr-3" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search applications, services, or type a command..."
            className="border-0 focus-visible:ring-0 text-lg py-6 px-0 bg-transparent"
          />
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-gray-700 bg-gray-800 px-2 font-mono text-xs text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {filteredCommands.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No results found for &quot;{search}&quot;</p>
                <p className="text-sm mt-1">Try searching for applications, services, or commands</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category} className="mb-2">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {categoryLabels[category] || category}
                  </div>
                  {commands.map((cmd, idx) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;
                    
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isSelected
                            ? "bg-blue-600/20 text-blue-400"
                            : "hover:bg-gray-800 text-gray-200"
                        }`}
                      >
                        <div className={`p-1.5 rounded-md ${
                          isSelected ? "bg-blue-600/30" : "bg-gray-800"
                        }`}>
                          {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{cmd.title}</div>
                          {cmd.description && (
                            <div className="text-sm text-gray-500 truncate">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-gray-700 bg-gray-800 px-1.5 font-mono text-xs text-gray-400">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        <ArrowRight className={`h-4 w-4 ${isSelected ? "text-blue-400" : "text-gray-600"}`} />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">↵</kbd>
              to select
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>K to open</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
