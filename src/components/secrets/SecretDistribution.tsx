"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Share2,
  Server,
  Globe,
  Database,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  Settings,
  Plus,
  Trash2,
  Send,
  Shield,
  Lock,
  Key
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Secret {
  id: string;
  name: string;
  type: string;
  environment: string;
  status: string;
  usedBy: string[];
  metadata: {
    description: string;
    criticality: string;
  };
}

interface SecretUsage {
  secretId: string;
  serviceId: string;
  serviceName: string;
  lastAccessed: Date;
  accessCount: number;
  status: 'active' | 'inactive';
}

interface DistributionTarget {
  id: string;
  name: string;
  type: 'kubernetes' | 'docker' | 'vm' | 'function';
  environment: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
  secretCount: number;
}

interface SecretDistributionProps {
  secrets: Secret[];
  usage: SecretUsage[];
  onDistributeSecret: (secretId: string, targets: string[]) => void;
}

export function SecretDistribution({ secrets, usage, onDistributeSecret }: SecretDistributionProps) {
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [distributionTargets] = useState<DistributionTarget[]>([
    {
      id: 'k3s-cluster',
      name: 'K3s Cluster (Production)',
      type: 'kubernetes',
      environment: 'production',
      endpoint: 'https://k3s.gmac.io:6443',
      status: 'connected',
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      secretCount: 12
    },
    {
      id: 'k3s-staging',
      name: 'K3s Cluster (Staging)',
      type: 'kubernetes',
      environment: 'staging',
      endpoint: 'https://k3s-staging.gmac.io:6443',
      status: 'connected',
      lastSync: new Date(Date.now() - 15 * 60 * 1000),
      secretCount: 8
    },
    {
      id: 'gitea-server',
      name: 'Gitea VPS',
      type: 'vm',
      environment: 'production',
      endpoint: 'gitea.gmac.io',
      status: 'connected',
      lastSync: new Date(Date.now() - 10 * 60 * 1000),
      secretCount: 5
    },
    {
      id: 'harbor-registry',
      name: 'Harbor Registry',
      type: 'docker',
      environment: 'production',
      endpoint: 'harbor.gmac.io',
      status: 'connected',
      lastSync: new Date(Date.now() - 8 * 60 * 1000),
      secretCount: 3
    },
    {
      id: 'lambda-functions',
      name: 'AWS Lambda Functions',
      type: 'function',
      environment: 'production',
      endpoint: 'us-east-1.amazonaws.com',
      status: 'error',
      lastSync: new Date(Date.now() - 60 * 60 * 1000),
      secretCount: 2
    }
  ]);

  const getTypeIcon = (type: DistributionTarget['type']) => {
    switch (type) {
      case 'kubernetes':
        return <Server className="h-4 w-4" />;
      case 'docker':
        return <Database className="h-4 w-4" />;
      case 'vm':
        return <Globe className="h-4 w-4" />;
      case 'function':
        return <Zap className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: DistributionTarget['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: DistributionTarget['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'disconnected':
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500';
    }
  };

  const toggleTarget = (targetId: string) => {
    setSelectedTargets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(targetId)) {
        newSet.delete(targetId);
      } else {
        newSet.add(targetId);
      }
      return newSet;
    });
  };

  const handleDistribute = () => {
    if (selectedSecret && selectedTargets.size > 0) {
      onDistributeSecret(selectedSecret, Array.from(selectedTargets));
      setSelectedSecret(null);
      setSelectedTargets(new Set());
    }
  };

  // Calculate statistics
  const connectedTargets = distributionTargets.filter(t => t.status === 'connected').length;
  const totalSecrets = distributionTargets.reduce((sum, t) => sum + t.secretCount, 0);
  const errorTargets = distributionTargets.filter(t => t.status === 'error').length;
  const activeDistributions = usage.filter(u => u.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-500" />
            Secret Distribution
          </h2>
          <p className="text-gray-400 text-sm">
            Secure distribution of secrets to services and environments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Target
          </Button>
          <Button onClick={() => setSelectedSecret(secrets[0]?.id || null)}>
            <Send className="h-4 w-4 mr-2" />
            Distribute Secret
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Server className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{connectedTargets}</p>
              <p className="text-sm text-gray-400">Connected Targets</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totalSecrets}</p>
              <p className="text-sm text-gray-400">Distributed Secrets</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{errorTargets}</p>
              <p className="text-sm text-gray-400">Sync Errors</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{activeDistributions}</p>
              <p className="text-sm text-gray-400">Active Usages</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Distribution Targets */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Distribution Targets</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {distributionTargets.map(target => (
            <Card key={target.id} className="p-4 border-gray-800">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getTypeIcon(target.type)}
                  <div>
                    <h4 className="font-semibold">{target.name}</h4>
                    <p className="text-xs text-gray-400">{target.endpoint}</p>
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(target.status)}>
                  {getStatusIcon(target.status)}
                  {target.status}
                </Badge>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Environment</span>
                  <Badge variant="secondary" className="capitalize">{target.environment}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Secrets Count</span>
                  <span>{target.secretCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Last Sync</span>
                  <span>{formatDistanceToNow(target.lastSync, { addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="h-3 w-3 mr-1" />
                  View Secrets
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Secret Usage Analysis */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Secret Usage Analysis</h3>
        </div>

        <div className="space-y-3">
          {usage.slice(0, 10).map(usageItem => {
            const secret = secrets.find(s => s.id === usageItem.secretId);
            if (!secret) return null;

            return (
              <div key={`${usageItem.secretId}-${usageItem.serviceId}`} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-blue-500" />
                  <div>
                    <h4 className="font-medium text-sm">{secret.name}</h4>
                    <p className="text-xs text-gray-400">{usageItem.serviceName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{usageItem.accessCount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">accesses</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Last accessed</p>
                    <p className="text-xs">{formatDistanceToNow(usageItem.lastAccessed, { addSuffix: true })}</p>
                  </div>
                  <Badge variant="outline" className={usageItem.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                    {usageItem.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {usage.length === 0 && (
          <div className="text-center py-8">
            <Share2 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No usage data</h3>
            <p className="text-gray-500">Secret usage information will appear here once secrets are distributed</p>
          </div>
        )}
      </Card>

      {/* Distribution Modal */}
      {selectedSecret && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Send className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold">Distribute Secret</h3>
            </div>

            <div className="mb-4">
              <h4 className="font-medium mb-2">Selected Secret</h4>
              <div className="p-3 bg-gray-900/50 rounded-lg">
                <p className="font-medium">{secrets.find(s => s.id === selectedSecret)?.name}</p>
                <p className="text-sm text-gray-400">{secrets.find(s => s.id === selectedSecret)?.metadata.description}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-3">Select Distribution Targets</h4>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {distributionTargets.map(target => (
                  <div
                    key={target.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTargets.has(target.id)
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => toggleTarget(target.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(target.type)}
                        <div>
                          <p className="font-medium text-sm">{target.name}</p>
                          <p className="text-xs text-gray-400">{target.endpoint}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize text-xs">{target.environment}</Badge>
                        {getStatusIcon(target.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                onClick={handleDistribute}
                disabled={selectedTargets.size === 0}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Distribute to {selectedTargets.size} target{selectedTargets.size !== 1 ? 's' : ''}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedSecret(null);
                  setSelectedTargets(new Set());
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}