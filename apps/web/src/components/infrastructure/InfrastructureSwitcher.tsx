"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Server,
  GitBranch,
  Activity,
  DollarSign,
  Plus,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Infrastructure, InfrastructureType } from "@/lib/infrastructure/types";

interface InfrastructureSwitcherProps {
  selectedId?: string;
  onSelect: (infrastructure: Infrastructure) => void;
  onCreateNew?: () => void;
}

export function InfrastructureSwitcher({
  selectedId,
  onSelect,
  onCreateNew,
}: InfrastructureSwitcherProps) {
  const { data: infrastructures, isLoading } = useQuery({
    queryKey: ["infrastructures"],
    queryFn: async () => {
      const response = await fetch("/api/infrastructure");
      if (!response.ok) throw new Error("Failed to fetch infrastructures");
      return response.json() as Promise<Infrastructure[]>;
    },
  });

  const getIcon = (type: InfrastructureType) => {
    switch (type) {
      case "k3s":
        return <Server className="h-4 w-4" />;
      case "gitea-vps":
        return <GitBranch className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Infrastructure["status"]) => {
    switch (status) {
      case "active":
        return "success";
      case "provisioning":
        return "warning";
      case "error":
        return "error";
      case "stopped":
        return "secondary";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-10 bg-gray-800 rounded" />;
  }

  const selected = infrastructures?.find((i) => i.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Quick Switcher */}
      <div className="flex items-center gap-4">
        <Select value={selectedId} onValueChange={(id) => {
          const infra = infrastructures?.find((i) => i.id === id);
          if (infra) onSelect(infra);
        }}>
          <SelectTrigger className="w-[300px]">
            <SelectValue>
              {selected ? (
                <div className="flex items-center gap-2">
                  {getIcon(selected.type)}
                  <span>{selected.name}</span>
                  <Badge variant={getStatusColor(selected.status)} className="ml-auto">
                    {selected.status}
                  </Badge>
                </div>
              ) : (
                "Select infrastructure"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {infrastructures?.map((infra) => (
              <SelectItem key={infra.id} value={infra.id}>
                <div className="flex items-center gap-2">
                  {getIcon(infra.type)}
                  <span>{infra.name}</span>
                  <Badge
                    variant={getStatusColor(infra.status)}
                    className="ml-auto"
                  >
                    {infra.status}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onCreateNew && (
          <Button onClick={onCreateNew} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Infrastructure
          </Button>
        )}
      </div>

      {/* Infrastructure Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {infrastructures?.map((infra) => (
          <Card
            key={infra.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedId === infra.id
                ? "ring-2 ring-blue-500"
                : "hover:ring-1 hover:ring-gray-600"
            }`}
            onClick={() => onSelect(infra)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getIcon(infra.type)}
                <h3 className="font-medium">{infra.name}</h3>
              </div>
              <Badge variant={getStatusColor(infra.status)}>
                {infra.status}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Type:</span>
                <span className="capitalize">{infra.type.replace("-", " ")}</span>
              </div>

              {infra.resources && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Resources:</span>
                  <span>
                    {infra.resources.nodes} {infra.resources.nodes === 1 ? "node" : "nodes"}
                  </span>
                </div>
              )}

              {infra.cost && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Cost:</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {infra.cost.monthly.toFixed(2)}/mo
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-800">
                <a
                  href={infra.endpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {infra.endpoint}
                  <ChevronRight className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Created {new Date(infra.created).toLocaleDateString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Open settings
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create New Card */}
      {onCreateNew && (
        <Card
          className="p-4 border-dashed cursor-pointer hover:border-gray-600 transition-colors"
          onClick={onCreateNew}
        >
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Plus className="h-8 w-8 mb-2" />
            <p className="font-medium">Add New Infrastructure</p>
            <p className="text-sm">Deploy K3s cluster or Gitea VPS</p>
          </div>
        </Card>
      )}
    </div>
  );
}