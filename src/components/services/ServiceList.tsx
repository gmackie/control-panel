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
  Eye,
} from "lucide-react";
import { AppService } from "@/types";

interface ServiceListProps {
  services: AppService[];
  onEdit?: (service: AppService) => void;
  onDelete?: (service: AppService) => void;
  onToggleStatus?: (service: AppService) => void;
  onView?: (service: AppService) => void;
}

export default function ServiceList({
  services,
  onEdit,
  onDelete,
  onToggleStatus,
  onView,
}: ServiceListProps) {
  const [selectedService, setSelectedService] = useState<string | null>(null);

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
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Service</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Environment</th>
              <th className="text-left p-4 font-medium">Version</th>
              <th className="text-left p-4 font-medium">Uptime</th>
              <th className="text-left p-4 font-medium">URL</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr
                key={service.id}
                className="border-t border-border hover:bg-muted/30"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getTypeIcon(service.type)}
                    </div>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {service.type}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusColor(
                        service.status
                      )}`}
                    />
                    <span className="text-sm capitalize">{service.status}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-xs bg-muted px-2 py-1 rounded">
                    {service.environment}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm">v{service.version}</span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-muted-foreground">
                    {service.uptime}
                  </span>
                </td>
                <td className="p-4">
                  {service.url ? (
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="text-xs">Visit</span>
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setSelectedService(
                          selectedService === service.id ? null : service.id
                        )
                      }
                      className="p-1 hover:bg-muted rounded"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {selectedService === service.id && (
                      <div className="absolute right-0 top-8 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[160px]">
                        <button
                          onClick={() => {
                            onView?.(service);
                            setSelectedService(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => {
                            onEdit?.(service);
                            setSelectedService(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            onToggleStatus?.(service);
                            setSelectedService(null);
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
                            setSelectedService(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
