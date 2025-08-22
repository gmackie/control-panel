"use client";

import { useState } from "react";
import {
  Globe,
  Database,
  Settings,
  ExternalLink,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
} from "lucide-react";
import { AppService } from "@/types";

interface ServiceCardProps {
  service: AppService;
  onEdit?: (service: AppService) => void;
  onDelete?: (service: AppService) => void;
  onToggleStatus?: (service: AppService) => void;
}

export default function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggleStatus,
}: ServiceCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "nextjs":
        return <Globe className="w-4 h-4" />;
      case "go-api":
        return <Settings className="w-4 h-4" />;
      case "turso":
        return <Database className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            {getTypeIcon(service.type)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{service.name}</h3>
            <p className="text-sm text-muted-foreground">{service.type}</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-muted rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[160px]">
              <button
                onClick={() => {
                  onEdit?.(service);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => {
                  onToggleStatus?.(service);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                {service.status === "healthy" ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {service.status === "healthy" ? "Pause" : "Start"}
              </button>
              <button
                onClick={() => {
                  onDelete?.(service);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`}
        />
        <span className="text-sm capitalize">{service.status}</span>
        <span className="text-sm text-muted-foreground">•</span>
        <span className="text-sm text-muted-foreground">{service.uptime}</span>
      </div>

      {/* Environment and Version */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-muted px-2 py-1 rounded">
            {service.environment}
          </span>
          <span className="text-xs text-muted-foreground">
            v{service.version}
          </span>
        </div>

        {service.url && (
          <a
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="text-xs">Visit</span>
          </a>
        )}
      </div>

      {/* Metrics */}
      {service.metrics && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">CPU</p>
            <p className="text-sm font-medium">
              {service.metrics.cpu ? `${service.metrics.cpu}%` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Memory</p>
            <p className="text-sm font-medium">
              {service.metrics.memory ? `${service.metrics.memory}%` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Requests</p>
            <p className="text-sm font-medium">
              {service.metrics.requests
                ? service.metrics.requests.toLocaleString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Response Time</p>
            <p className="text-sm font-medium">
              {service.metrics.responseTime
                ? `${service.metrics.responseTime}ms`
                : "N/A"}
            </p>
          </div>
        </div>
      )}

      {/* Integrations */}
      {service.integrations && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Integrations</p>
          <div className="flex gap-2">
            {service.integrations.stripe && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Stripe
              </span>
            )}
            {service.integrations.turso && (
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                Turso
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
