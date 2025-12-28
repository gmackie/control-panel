"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  History,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Key,
  Share2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Shield,
  Lock,
  Unlock
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: 'created' | 'read' | 'updated' | 'deleted' | 'rotated' | 'distributed' | 'accessed';
  secretId: string;
  secretName: string;
  userId: string;
  userEmail: string;
  serviceId?: string;
  serviceName?: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure' | 'denied';
  details?: string;
  metadata?: Record<string, any>;
}

interface SecretAuditLogProps {
  onExportAuditLog: () => void;
}

export function SecretAuditLog({ onExportAuditLog }: SecretAuditLogProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedResult, setSelectedResult] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("24h");

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAuditLogs(generateMockAuditLogs());
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [timeRange, fetchAuditLogs]);

  const generateMockAuditLogs = (): AuditLogEntry[] => {
    const now = new Date();
    const logs: AuditLogEntry[] = [
      {
        id: 'audit-001',
        timestamp: new Date(now.getTime() - 15 * 60 * 1000),
        action: 'accessed',
        secretId: 'secret-001',
        secretName: 'GitHub OAuth App Secret',
        userId: 'system',
        userEmail: 'system@gmac.io',
        serviceId: 'control-panel',
        serviceName: 'Control Panel',
        ipAddress: '10.0.0.15',
        userAgent: 'Control-Panel/1.0',
        result: 'success',
        details: 'Secret accessed for OAuth authentication'
      },
      {
        id: 'audit-002',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000),
        action: 'rotated',
        secretId: 'secret-003',
        secretName: 'Stripe API Key',
        userId: 'admin@gmac.io',
        userEmail: 'admin@gmac.io',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        result: 'success',
        details: 'Automatic rotation completed successfully',
        metadata: { rotationType: 'automatic', previousVersion: 'v2', newVersion: 'v3' }
      },
      {
        id: 'audit-003',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        action: 'read',
        secretId: 'secret-002',
        secretName: 'Turso Database Token',
        userId: 'developer@gmac.io',
        userEmail: 'developer@gmac.io',
        ipAddress: '192.168.1.150',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        result: 'success',
        details: 'Secret viewed through web interface'
      },
      {
        id: 'audit-004',
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        action: 'distributed',
        secretId: 'secret-005',
        secretName: 'Kubernetes Service Account Token',
        userId: 'admin@gmac.io',
        userEmail: 'admin@gmac.io',
        serviceId: 'k3s-cluster',
        serviceName: 'K3s Cluster',
        ipAddress: '192.168.1.100',
        userAgent: 'kubectl/1.28.0',
        result: 'success',
        details: 'Secret distributed to Kubernetes cluster'
      },
      {
        id: 'audit-005',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        action: 'updated',
        secretId: 'secret-007',
        secretName: 'Twilio Account SID',
        userId: 'developer@gmac.io',
        userEmail: 'developer@gmac.io',
        ipAddress: '192.168.1.150',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        result: 'success',
        details: 'Secret metadata updated',
        metadata: { field: 'description', oldValue: 'Old description', newValue: 'Updated description' }
      },
      {
        id: 'audit-006',
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        action: 'read',
        secretId: 'secret-004',
        secretName: 'Harbor Registry Admin Password',
        userId: 'unauthorizeduser@external.com',
        userEmail: 'unauthorizeduser@external.com',
        ipAddress: '203.0.113.123',
        userAgent: 'curl/7.68.0',
        result: 'denied',
        details: 'Access denied - insufficient permissions'
      },
      {
        id: 'audit-007',
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        action: 'created',
        secretId: 'secret-008',
        secretName: 'SSL Certificate (Wildcard)',
        userId: 'admin@gmac.io',
        userEmail: 'admin@gmac.io',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        result: 'success',
        details: 'New SSL certificate secret created'
      },
      {
        id: 'audit-008',
        timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000),
        action: 'accessed',
        secretId: 'secret-006',
        secretName: 'SendGrid API Key',
        userId: 'system',
        userEmail: 'system@gmac.io',
        serviceId: 'notification-service',
        serviceName: 'Notification Service',
        ipAddress: '10.0.0.25',
        userAgent: 'NotificationService/2.1',
        result: 'success',
        details: 'Secret accessed for email delivery'
      },
      {
        id: 'audit-009',
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        action: 'deleted',
        secretId: 'secret-009',
        secretName: 'OpenRouter API Key (Staging)',
        userId: 'admin@gmac.io',
        userEmail: 'admin@gmac.io',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        result: 'success',
        details: 'Expired secret removed from staging environment'
      },
      {
        id: 'audit-010',
        timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000),
        action: 'accessed',
        secretId: 'secret-010',
        secretName: 'SSH Deploy Key',
        userId: 'system',
        userEmail: 'system@gmac.io',
        serviceId: 'ci-pipeline',
        serviceName: 'CI Pipeline',
        ipAddress: '10.0.0.45',
        userAgent: 'GitLab-Runner/15.0',
        result: 'failure',
        details: 'Secret access failed - key rotation in progress'
      }
    ];

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const getActionIcon = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'created':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'read':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-yellow-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'rotated':
        return <RefreshCw className="h-4 w-4 text-purple-500" />;
      case 'distributed':
        return <Share2 className="h-4 w-4 text-orange-500" />;
      case 'accessed':
        return <Key className="h-4 w-4 text-cyan-500" />;
    }
  };

  const getActionColor = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'created':
        return 'bg-green-500/20 text-green-400';
      case 'read':
        return 'bg-blue-500/20 text-blue-400';
      case 'updated':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'deleted':
        return 'bg-red-500/20 text-red-400';
      case 'rotated':
        return 'bg-purple-500/20 text-purple-400';
      case 'distributed':
        return 'bg-orange-500/20 text-orange-400';
      case 'accessed':
        return 'bg-cyan-500/20 text-cyan-400';
    }
  };

  const getResultIcon = (result: AuditLogEntry['result']) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'denied':
        return <Lock className="h-4 w-4 text-red-500" />;
    }
  };

  const getResultColor = (result: AuditLogEntry['result']) => {
    switch (result) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'failure':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'denied':
        return 'bg-red-500/20 text-red-400 border-red-500';
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = searchQuery === "" || 
      log.secretName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = selectedAction === "all" || log.action === selectedAction;
    const matchesResult = selectedResult === "all" || log.result === selectedResult;
    
    return matchesSearch && matchesAction && matchesResult;
  });

  // Calculate statistics
  const totalLogs = filteredLogs.length;
  const successfulActions = filteredLogs.filter(log => log.result === 'success').length;
  const failedActions = filteredLogs.filter(log => log.result === 'failure').length;
  const deniedActions = filteredLogs.filter(log => log.result === 'denied').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-blue-500" />
            Secret Access Audit Log
          </h2>
          <p className="text-gray-400 text-sm">
            Track all secret access and modification events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAuditLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={onExportAuditLog}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <History className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalLogs}</p>
              <p className="text-sm text-gray-400">Total Events</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{successfulActions}</p>
              <p className="text-sm text-gray-400">Successful</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{failedActions}</p>
              <p className="text-sm text-gray-400">Failed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Lock className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{deniedActions}</p>
              <p className="text-sm text-gray-400">Denied</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-md"
            />
          </div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
          >
            <option value="all">All Actions</option>
            <option value="created">Created</option>
            <option value="read">Read</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="rotated">Rotated</option>
            <option value="distributed">Distributed</option>
            <option value="accessed">Accessed</option>
          </select>
          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
          >
            <option value="all">All Results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="denied">Denied</option>
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="p-6">
        <div className="space-y-3">
          {filteredLogs.map(log => (
            <div key={log.id} className="p-4 bg-gray-900/30 rounded-lg border border-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                      <Badge variant="outline" className={getResultColor(log.result)}>
                        {getResultIcon(log.result)}
                        {log.result}
                      </Badge>
                      <span className="text-sm font-medium">{log.secretName}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{log.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{format(log.timestamp, 'MMM d, yyyy HH:mm:ss')}</span>
                      </div>
                      <div>
                        IP: {log.ipAddress}
                      </div>
                      {log.serviceName && (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span>{log.serviceName}</span>
                        </div>
                      )}
                    </div>

                    {log.details && (
                      <p className="text-sm text-gray-300 mb-2">{log.details}</p>
                    )}

                    {log.metadata && (
                      <div className="text-xs text-gray-500">
                        <span>Metadata: </span>
                        <code className="bg-gray-800 px-1 rounded">
                          {JSON.stringify(log.metadata, null, 0)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No audit logs found</h3>
            <p className="text-gray-500">
              {searchQuery || selectedAction !== 'all' || selectedResult !== 'all'
                ? 'Try adjusting your search criteria'
                : 'Audit logs will appear here as secrets are accessed'
              }
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}