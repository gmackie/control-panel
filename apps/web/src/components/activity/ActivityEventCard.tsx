"use client";

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitCommit,
  GitPullRequest,
  GitBranch,
  Rocket,
  User,
  CreditCard,
  AlertTriangle,
  AlertCircle,
  Shield,
  Database,
  Server,
  Settings,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { ActivityEvent, ActivitySource, ActivityCategory, ActivitySeverity } from "@/lib/activity/types";

interface ActivityEventCardProps {
  event: ActivityEvent;
}

const SOURCE_ICONS: Record<ActivitySource, React.ReactNode> = {
  gitea: <GitBranch className="h-4 w-4" />,
  clerk: <Shield className="h-4 w-4" />,
  stripe: <CreditCard className="h-4 w-4" />,
  sentry: <AlertTriangle className="h-4 w-4" />,
  posthog: <BarChart3 className="h-4 w-4" />,
  kubernetes: <Server className="h-4 w-4" />,
  neon: <Database className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
};

const SOURCE_COLORS: Record<ActivitySource, string> = {
  gitea: "text-green-500 bg-green-500/10",
  clerk: "text-purple-500 bg-purple-500/10",
  stripe: "text-blue-500 bg-blue-500/10",
  sentry: "text-orange-500 bg-orange-500/10",
  posthog: "text-cyan-500 bg-cyan-500/10",
  kubernetes: "text-blue-400 bg-blue-400/10",
  neon: "text-emerald-500 bg-emerald-500/10",
  system: "text-gray-400 bg-gray-400/10",
};

const CATEGORY_ICONS: Record<ActivityCategory, React.ReactNode> = {
  deployment: <Rocket className="h-4 w-4" />,
  auth: <User className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  infrastructure: <Server className="h-4 w-4" />,
  integration: <Settings className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  repository: <GitCommit className="h-4 w-4" />,
};

const SEVERITY_STYLES: Record<ActivitySeverity, { badge: string; dot: string }> = {
  info: { badge: "default", dot: "bg-blue-500" },
  warning: { badge: "warning", dot: "bg-yellow-500" },
  error: { badge: "error", dot: "bg-red-500" },
  critical: { badge: "error", dot: "bg-red-600 animate-pulse" },
};

export function ActivityEventCard({ event }: ActivityEventCardProps) {
  const sourceColor = SOURCE_COLORS[event.source];
  const severityStyle = SEVERITY_STYLES[event.severity];

  // Determine the icon based on event type
  const getEventIcon = () => {
    if (event.eventType.includes("pull_request")) {
      return <GitPullRequest className="h-4 w-4" />;
    }
    if (event.eventType.includes("push") || event.eventType.includes("commit")) {
      return <GitCommit className="h-4 w-4" />;
    }
    return CATEGORY_ICONS[event.category] || SOURCE_ICONS[event.source];
  };

  return (
    <div className="flex gap-4 p-4 hover:bg-gray-900/50 rounded-lg transition-colors">
      {/* Left: Icon */}
      <div className={`flex-shrink-0 p-2 rounded-lg ${sourceColor}`}>
        {getEventIcon()}
      </div>

      {/* Middle: Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Title */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2 h-2 rounded-full ${severityStyle.dot}`} />
              <p className="font-medium text-sm">{event.title}</p>
              {event.severity !== "info" && (
                <Badge variant={severityStyle.badge as "default" | "warning" | "error"} className="text-xs">
                  {event.severity}
                </Badge>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {event.description}
              </p>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span className="capitalize">{event.source}</span>
              {event.appName && (
                <>
                  <span>•</span>
                  <span>{event.appName}</span>
                </>
              )}
              {event.environment && (
                <>
                  <span>•</span>
                  <Badge variant="outline" className="text-xs py-0">
                    {event.environment}
                  </Badge>
                </>
              )}
              {event.actor && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {event.actor.avatar ? (
                      <img 
                        src={event.actor.avatar} 
                        alt={event.actor.name || ""} 
                        className="w-4 h-4 rounded-full"
                      />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    {event.actor.name || event.actor.email || event.actor.id}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Timestamp and links */}
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
            </p>
            {event.links && event.links.length > 0 && (
              <div className="flex gap-1 mt-2 justify-end">
                {event.links.slice(0, 2).map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                  >
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      {link.label}
                      {link.external && <ExternalLink className="h-3 w-3 ml-1" />}
                    </Button>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
