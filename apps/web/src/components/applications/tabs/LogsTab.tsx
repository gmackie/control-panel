"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Terminal,
  Search,
  RefreshCw,
  Loader2,
  Download,
  Pause,
  Play,
  Filter,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface LogsTabProps {
  appId: string;
}

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  pod?: string;
  container?: string;
  metadata?: Record<string, string>;
}

interface LogsResponse {
  logs: LogEntry[];
  pods: string[];
  hasMore: boolean;
  nextCursor?: string;
}

export function LogsTab({ appId }: LogsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedPod, setSelectedPod] = useState<string>("all");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLogs, setStreamLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: LogsResponse }>({
    queryKey: ["app-logs", appId, selectedLevel, selectedPod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedLevel !== "all") params.set("level", selectedLevel);
      if (selectedPod !== "all") params.set("pod", selectedPod);
      params.set("limit", "200");
      
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json();
    },
    refetchInterval: isStreaming ? false : 30000,
  });

  const logs = data?.data?.logs || [];
  const pods = data?.data?.pods || [];

  useEffect(() => {
    if (isStreaming) {
      const params = new URLSearchParams();
      if (selectedLevel !== "all") params.set("level", selectedLevel);
      if (selectedPod !== "all") params.set("pod", selectedPod);
      params.set("stream", "true");

      eventSourceRef.current = new EventSource(
        `/api/apps/${encodeURIComponent(appId)}/logs/stream?${params}`
      );

      eventSourceRef.current.onmessage = (event) => {
        try {
          const logEntry = JSON.parse(event.data) as LogEntry;
          setStreamLogs((prev) => [...prev.slice(-499), logEntry]);
        } catch (e) {
          console.error("Failed to parse log entry:", e);
        }
      };

      eventSourceRef.current.onerror = () => {
        setIsStreaming(false);
        eventSourceRef.current?.close();
      };

      return () => {
        eventSourceRef.current?.close();
      };
    } else {
      setStreamLogs([]);
    }
  }, [isStreaming, appId, selectedLevel, selectedPod]);

  useEffect(() => {
    if (isStreaming && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamLogs, isStreaming]);

  const displayLogs = isStreaming ? streamLogs : logs;
  
  const filteredLogs = displayLogs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      log.pod?.toLowerCase().includes(query) ||
      log.container?.toLowerCase().includes(query)
    );
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "debug":
        return "text-gray-400";
      case "info":
        return "text-blue-400";
      case "warn":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      case "fatal":
        return "text-red-600";
      default:
        return "text-gray-400";
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "debug":
        return <Badge variant="secondary" className="text-xs">DBG</Badge>;
      case "info":
        return <Badge variant="default" className="bg-blue-600 text-xs">INF</Badge>;
      case "warn":
        return <Badge variant="warning" className="text-xs">WRN</Badge>;
      case "error":
        return <Badge variant="error" className="text-xs">ERR</Badge>;
      case "fatal":
        return <Badge variant="error" className="bg-red-800 text-xs">FTL</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{level.toUpperCase().slice(0, 3)}</Badge>;
    }
  };

  const handleDownload = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.pod ? `[${log.pod}] ` : ""}${log.message}`)
      .join("\n");
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${appId}-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading && !isStreaming) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-red-400">Failed to load logs</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Application Logs
          {isStreaming && (
            <Badge variant="default" className="bg-green-600 animate-pulse">
              Live
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant={isStreaming ? "default" : "outline"}
            size="sm"
            onClick={() => setIsStreaming(!isStreaming)}
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Stream
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {!isStreaming && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-200" />
            </button>
          )}
        </div>
        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
          <SelectTrigger className="w-32">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="fatal">Fatal</SelectItem>
          </SelectContent>
        </Select>
        {pods.length > 0 && (
          <Select value={selectedPod} onValueChange={setSelectedPod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Pods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pods</SelectItem>
              {pods.map((pod) => (
                <SelectItem key={pod} value={pod}>
                  {pod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gray-950 text-sm font-mono max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No logs found</p>
              {searchQuery && <p className="text-xs mt-1">Try adjusting your search filters</p>}
            </div>
          ) : (
            <div className="divide-y divide-gray-900">
              {filteredLogs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className="px-4 py-2 hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
                    </span>
                    {getLevelBadge(log.level)}
                    {log.pod && (
                      <span className="text-cyan-500 text-xs whitespace-nowrap">
                        [{log.pod}]
                      </span>
                    )}
                    <span className={`flex-1 break-all ${getLevelColor(log.level)}`}>
                      {log.message}
                    </span>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-1 ml-20 flex flex-wrap gap-2">
                      {Object.entries(log.metadata).map(([key, value]) => (
                        <span key={key} className="text-xs text-gray-500">
                          {key}=<span className="text-gray-400">{value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </Card>

      <p className="text-xs text-gray-500 text-center">
        Showing {filteredLogs.length} log entries
        {searchQuery && ` matching "${searchQuery}"`}
      </p>
    </div>
  );
}
