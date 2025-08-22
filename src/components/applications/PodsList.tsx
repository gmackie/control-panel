"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Box,
  Cpu,
  HardDrive,
  Activity,
  RefreshCw,
  Terminal,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Pod } from "@/types/deployments";

interface PodsListProps {
  deploymentId: string;
  pods: Pod[];
}

export function PodsList({ deploymentId, pods }: PodsListProps) {
  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "logs" | "events">("overview");

  const getPodStatusIcon = (status: string, ready: boolean) => {
    if (!ready) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    switch (status) {
      case "running":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPodStatusColor = (status: string, ready: boolean) => {
    if (!ready) return "warning";
    switch (status) {
      case "running":
        return "success";
      case "failed":
        return "error";
      case "pending":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pods.map((pod) => (
          <Card
            key={pod.id}
            className={`p-4 cursor-pointer hover:border-gray-700 transition-colors ${
              selectedPod === pod.id ? "border-blue-500" : ""
            }`}
            onClick={() => setSelectedPod(pod.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getPodStatusIcon(pod.status, pod.ready)}
                <div>
                  <p className="font-medium text-sm truncate max-w-[200px]">
                    {pod.name}
                  </p>
                  <p className="text-xs text-gray-400">Node: {pod.node}</p>
                </div>
              </div>
              <Badge variant={getPodStatusColor(pod.status, pod.ready) as any} className="text-xs">
                {pod.ready ? "Ready" : "Not Ready"}
              </Badge>
            </div>

            <div className="space-y-2">
              {/* CPU Usage */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Cpu className="h-3 w-3" />
                    CPU
                  </span>
                  <span>{Math.round(pod.cpu.usage)}m / {pod.cpu.limit}m</span>
                </div>
                <Progress value={(pod.cpu.usage / pod.cpu.limit) * 100} className="h-1" />
              </div>

              {/* Memory Usage */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-gray-400">
                    <HardDrive className="h-3 w-3" />
                    Memory
                  </span>
                  <span>{Math.round(pod.memory.usage)}Mi / {pod.memory.limit}Mi</span>
                </div>
                <Progress value={(pod.memory.usage / pod.memory.limit) * 100} className="h-1" />
              </div>

              <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
                <span>Restarts: {pod.restarts}</span>
                <span>Age: {pod.age}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pod Details */}
      {selectedPod && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Pod Details</h4>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "overview" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("overview")}
              >
                <Activity className="h-4 w-4 mr-1" />
                Overview
              </Button>
              <Button
                variant={viewMode === "logs" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("logs")}
              >
                <FileText className="h-4 w-4 mr-1" />
                Logs
              </Button>
              <Button
                variant={viewMode === "events" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("events")}
              >
                <AlertCircle className="h-4 w-4 mr-1" />
                Events
              </Button>
            </div>
          </div>

          {viewMode === "overview" && (
            <div className="space-y-4">
              {pods
                .find((p) => p.id === selectedPod)
                ?.containers.map((container) => (
                  <div key={container.name} className="p-4 bg-gray-900 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium">{container.name}</h5>
                      <Badge variant={container.ready ? "success" : "error"}>
                        {container.state}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-400">
                        Image: <span className="text-gray-200 font-mono text-xs">{container.image}</span>
                      </p>
                      <p className="text-gray-400">
                        Restarts: <span className="text-gray-200">{container.restartCount}</span>
                      </p>
                      {container.started && (
                        <p className="text-gray-400">
                          Started: <span className="text-gray-200">{new Date(container.started).toLocaleString()}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {viewMode === "logs" && (
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-xs text-gray-400 font-mono">
                <code>
{`[2024-01-10 12:34:56] INFO: Application started successfully
[2024-01-10 12:34:57] INFO: Connected to database
[2024-01-10 12:34:58] INFO: Server listening on port 3000
[2024-01-10 12:35:01] INFO: Health check passed
[2024-01-10 12:35:10] INFO: Handled GET /api/health - 200 OK`}
                </code>
              </pre>
            </div>
          )}

          {viewMode === "events" && (
            <div className="space-y-2">
              {pods
                .find((p) => p.id === selectedPod)
                ?.events.map((event, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-gray-900 rounded-lg text-sm"
                  >
                    <Badge
                      variant={event.type === "Normal" ? "default" : "warning"}
                      className="text-xs mt-0.5"
                    >
                      {event.type}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{event.reason}</span>
                        {event.count > 1 && (
                          <Badge variant="outline" className="text-xs">
                            x{event.count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-400">{event.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(event.lastTimestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}