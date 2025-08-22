"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClusterStats } from "@/types/cluster";
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Activity,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface ClusterOverviewProps {
  stats: ClusterStats;
}

export function ClusterOverview({ stats }: ClusterOverviewProps) {
  const cards = [
    {
      title: "Nodes",
      icon: Server,
      value: stats.nodes.total,
      subtitle: `${stats.nodes.ready} ready, ${stats.nodes.notReady} not ready`,
      detail: `${stats.nodes.masters} masters, ${stats.nodes.workers} workers`,
      color: stats.nodes.notReady > 0 ? "text-yellow-500" : "text-green-500",
    },
    {
      title: "CPU Usage",
      icon: Cpu,
      value: `${stats.resources.cpu.percentage.toFixed(1)}%`,
      subtitle: `${stats.resources.cpu.used.toFixed(1)} / ${stats.resources.cpu.total} cores`,
      progress: stats.resources.cpu.percentage,
      color: stats.resources.cpu.percentage > 80 ? "text-red-500" : "text-blue-500",
    },
    {
      title: "Memory Usage",
      icon: HardDrive,
      value: `${stats.resources.memory.percentage.toFixed(1)}%`,
      subtitle: `${(stats.resources.memory.used / 1024).toFixed(1)} / ${(
        stats.resources.memory.total / 1024
      ).toFixed(1)} GB`,
      progress: stats.resources.memory.percentage,
      color: stats.resources.memory.percentage > 80 ? "text-red-500" : "text-green-500",
    },
    {
      title: "Pods",
      icon: Activity,
      value: stats.resources.pods.running,
      subtitle: `${stats.resources.pods.total} capacity`,
      detail: stats.resources.pods.failed > 0 
        ? `${stats.resources.pods.failed} failed` 
        : "All healthy",
      color: stats.resources.pods.failed > 0 ? "text-red-500" : "text-purple-500",
    },
    {
      title: "Monthly Cost",
      icon: DollarSign,
      value: `€${stats.cost.monthly.toFixed(2)}`,
      subtitle: `€${stats.cost.hourly.toFixed(2)}/hour`,
      trend: "+5%",
      color: "text-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Icon className={`h-5 w-5 ${card.color}`} />
              {card.trend && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <TrendingUp className="h-3 w-3" />
                  {card.trend}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-sm text-gray-400">{card.subtitle}</p>
              {card.detail && (
                <p className="text-xs text-gray-500">{card.detail}</p>
              )}
            </div>
            {card.progress !== undefined && (
              <div className="mt-3">
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      card.progress > 80 ? "bg-red-500" : card.color.replace("text-", "bg-")
                    }`}
                    style={{ width: `${Math.min(card.progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}