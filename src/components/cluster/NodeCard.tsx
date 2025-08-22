"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { K3sNode } from "@/types/cluster";
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Activity, 
  Trash2, 
  Power,
  RefreshCw,
  DollarSign
} from "lucide-react";

interface NodeCardProps {
  node: K3sNode;
  onRemove: (nodeName: string) => void;
  onPowerAction: (nodeName: string, action: 'reboot' | 'poweroff') => void;
}

export function NodeCard({ node, onRemove, onPowerAction }: NodeCardProps) {
  const cpuUsagePercent = (node.cpu.usage / parseInt(node.cpu.capacity)) * 100;
  const memoryUsagePercent = (parseInt(node.memory.usage.toString()) / parseInt(node.memory.capacity)) * 100;
  const podUsagePercent = (node.pods.current / parseInt(node.pods.capacity)) * 100;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'notready':
        return 'error';
      default:
        return 'warning';
    }
  };

  const formatBytes = (bytes: number | string): string => {
    const value = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Server className="h-8 w-8 text-gray-400" />
          <div>
            <h3 className="font-semibold text-lg">{node.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={getStatusColor(node.status)}>
                {node.status}
              </Badge>
              <Badge variant="outline">
                {node.role}
              </Badge>
              {node.hetznerServer && (
                <Badge variant="secondary">
                  {node.hetznerServer.server_type.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPowerAction(node.name, 'reboot')}
            disabled={!node.hetznerServer}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(node.name)}
            className="text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Server Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">IP Address</p>
            <p className="font-mono">{node.externalIP || node.internalIP}</p>
          </div>
          <div>
            <p className="text-gray-400">K3s Version</p>
            <p className="font-mono">{node.version}</p>
          </div>
          {node.hetznerServer && (
            <>
              <div>
                <p className="text-gray-400">Location</p>
                <p>{node.hetznerServer.datacenter.location.city}</p>
              </div>
              <div>
                <p className="text-gray-400">Cost</p>
                <p className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {node.hetznerServer.server_type.prices[0]?.price_monthly.gross} EUR/mo
                </p>
              </div>
            </>
          )}
        </div>

        {/* Resource Usage */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" /> CPU
              </span>
              <span>{cpuUsagePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(cpuUsagePercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {node.cpu.usage.toFixed(2)} / {node.cpu.capacity} cores
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" /> Memory
              </span>
              <span>{memoryUsagePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(memoryUsagePercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {formatBytes(node.memory.usage)} / {formatBytes(node.memory.capacity)}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> Pods
              </span>
              <span>{podUsagePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(podUsagePercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {node.pods.current} / {node.pods.capacity} pods
            </p>
          </div>
        </div>

        {/* Conditions */}
        {node.conditions.some(c => c.status !== 'True' && c.type !== 'Ready') && (
          <div className="border-t border-gray-800 pt-3">
            <p className="text-sm font-medium mb-2">Conditions</p>
            <div className="space-y-1">
              {node.conditions
                .filter(c => c.status !== 'True' && c.type !== 'Ready')
                .map((condition, i) => (
                  <div key={i} className="text-xs">
                    <Badge variant="warning" className="mb-1">
                      {condition.type}
                    </Badge>
                    <p className="text-gray-400">{condition.message}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}