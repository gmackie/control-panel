"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle,
  Terminal,
  FileText,
  Layers,
  Eye,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  source: string;
  service: string;
  context?: Record<string, any>;
  stackTrace?: string;
}

interface LogAggregationProps {
  sources: string[];
  timeRange: string;
}

export function LogAggregation({ sources, timeRange }: LogAggregationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const generateMockLogs = (): LogEntry[] => {
    const logs: LogEntry[] = [];
    const now = new Date();
    const sources = ['k3s-cluster', 'api-gateway', 'database', 'gitea', 'drone', 'harbor', 'argocd'];
    const services = ['control-panel-api', 'gitea-server', 'drone-ci', 'harbor-registry', 'argocd', 'postgresql'];

    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      const level = ['error', 'warn', 'info', 'debug'][Math.floor(Math.random() * 4)] as LogEntry['level'];
      const source = sources[Math.floor(Math.random() * sources.length)];
      const service = services[Math.floor(Math.random() * services.length)];

      const messages = {
        error: [
          'Failed to connect to database: connection timeout after 30s',
          'HTTP 500 error in /api/deployments endpoint',
          'Container failed to start: image pull error',
          'Authentication failed for user admin@gmac.io'
        ],
        warn: [
          'High memory usage detected: 85% of available memory in use',
          'SSL certificate expires in 14 days',
          'Rate limit approaching for API key',
          'Slow query detected: execution time 2.3s'
        ],
        info: [
          'Deployment completed successfully for control-panel v2.4.0',
          'New user registered: user@example.com',
          'Cache invalidated for /api/applications',
          'Health check passed for all services'
        ],
        debug: [
          'Processing webhook from gitea repository',
          'Database connection pool size: 10/20',
          'Cache hit ratio: 94.5%',
          'Kubernetes pod scheduled on node k3s-worker-01'
        ]
      };

      logs.push({
        id: `log-${i}`,
        timestamp,
        level,
        message: messages[level][Math.floor(Math.random() * messages[level].length)],
        source,
        service,
        context: {
          userId: level === 'error' ? 'user-123' : undefined,
          requestId: `req-${Math.random().toString(36).substr(2, 9)}`,
          podName: source === 'k3s-cluster' ? `${service}-${Math.random().toString(36).substr(2, 5)}` : undefined
        },
        stackTrace: level === 'error' ? `Error: Connection timeout\n  at Database.connect (/app/src/db.js:42:5)\n  at Object.<anonymous> (/app/src/api.js:15:3)` : undefined
      });
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const logs = generateMockLogs();

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchQuery === "" || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    const matchesSource = selectedSource === "all" || log.source === selectedSource;
    
    return matchesSearch && matchesLevel && matchesSource;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'warn':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'info':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'debug':
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const logCounts = {
    error: logs.filter(l => l.level === 'error').length,
    warn: logs.filter(l => l.level === 'warn').length,
    info: logs.filter(l => l.level === 'info').length,
    debug: logs.filter(l => l.level === 'debug').length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Terminal className="h-5 w-5 text-green-500" />
          Log Aggregation
        </h2>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Search logs by message, service, or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
            >
              <option value="all">All Levels</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
            
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
            >
              <option value="all">All Sources</option>
              {sources.map(source => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Log Level Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-400">{logCounts.error}</p>
              <p className="text-sm text-gray-400">Errors</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-yellow-400">{logCounts.warn}</p>
              <p className="text-sm text-gray-400">Warnings</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Info className="h-6 w-6 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-400">{logCounts.info}</p>
              <p className="text-sm text-gray-400">Info</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-gray-500" />
            <div>
              <p className="text-2xl font-bold text-gray-400">{logCounts.debug}</p>
              <p className="text-sm text-gray-400">Debug</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Log Entries */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Log Entries ({filteredLogs.length})</h3>
          <div className="text-sm text-gray-400">
            Showing logs from last {timeRange}
          </div>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLogs.slice(0, 50).map(log => (
            <div key={log.id} className="border border-gray-800 rounded-lg">
              <div 
                className="flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-900/50"
                onClick={() => toggleLogExpansion(log.id)}
              >
                <div className="flex items-center gap-2 flex-shrink-0">
                  {expandedLogs.has(log.id) ? 
                    <ChevronDown className="h-4 w-4 text-gray-400" /> : 
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  }
                  {getLevelIcon(log.level)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={getLevelColor(log.level)}>
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-400">{log.service}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-400">{log.source}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-300 font-mono break-words">
                    {log.message}
                  </p>
                </div>
              </div>
              
              {expandedLogs.has(log.id) && (
                <div className="px-4 pb-4 border-t border-gray-800 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-400 mb-2">Context</h5>
                      <div className="space-y-1 text-sm font-mono">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Timestamp:</span>
                          <span>{log.timestamp.toISOString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Request ID:</span>
                          <span>{log.context?.requestId}</span>
                        </div>
                        {log.context?.userId && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">User ID:</span>
                            <span>{log.context.userId}</span>
                          </div>
                        )}
                        {log.context?.podName && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pod:</span>
                            <span>{log.context.podName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {log.stackTrace && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-400 mb-2">Stack Trace</h5>
                        <pre className="text-xs text-red-300 bg-red-900/20 p-2 rounded overflow-x-auto">
                          {log.stackTrace}
                        </pre>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <Button variant="outline" size="sm">
                      <Eye className="h-3 w-3 mr-1" />
                      View Full Context
                    </Button>
                    <Button variant="outline" size="sm">
                      <Layers className="h-3 w-3 mr-1" />
                      Related Logs
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {filteredLogs.length > 50 && (
            <div className="text-center p-4">
              <Button variant="outline">
                Load More Logs ({filteredLogs.length - 50} remaining)
              </Button>
            </div>
          )}
          
          {filteredLogs.length === 0 && (
            <div className="text-center p-8">
              <Terminal className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No Logs Found</h3>
              <p className="text-gray-500">
                No logs match your current search criteria. Try adjusting the filters.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}