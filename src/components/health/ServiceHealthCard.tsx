"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  Server,
  Globe,
  Database,
  Zap,
  Eye,
  Activity,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ServiceHealthCardProps {
  service: {
    id: string;
    name: string;
    type: 'application' | 'database' | 'external_api' | 'infrastructure';
    status: 'healthy' | 'degraded' | 'down' | 'maintenance';
    uptime: number;
    responseTime: number;
    errorRate: number;
    environment: 'production' | 'staging' | 'development';
    lastChecked: Date;
    endpoints: Array<{
      name: string;
      status: 'passing' | 'failing' | 'unknown';
      responseTime: number;
    }>;
    metrics?: {
      availability: number;
      responseTime: {
        p95: number;
      };
      errorRate: number;
    };
  };
  onViewDetails: (serviceId: string) => void;
  onRunCheck: (serviceId: string) => void;
}

export function ServiceHealthCard({ service, onViewDetails, onRunCheck }: ServiceHealthCardProps) {
  const getStatusIcon = () => {
    switch (service.status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'maintenance':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeIcon = () => {
    switch (service.type) {
      case 'application':
        return <Globe className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'external_api':
        return <Zap className="h-4 w-4" />;
      case 'infrastructure':
        return <Server className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (service.status) {
      case 'healthy':
        return 'border-green-500/20 bg-green-500/5';
      case 'degraded':
        return 'border-yellow-500/20 bg-yellow-500/5';
      case 'down':
        return 'border-red-500/20 bg-red-500/5';
      case 'maintenance':
        return 'border-blue-500/20 bg-blue-500/5';
      default:
        return 'border-gray-500/20 bg-gray-500/5';
    }
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production':
        return 'bg-red-500/20 text-red-300 border-red-500';
      case 'staging':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500';
      case 'development':
        return 'bg-blue-500/20 text-blue-300 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500';
    }
  };

  const healthyEndpoints = service.endpoints.filter(e => e.status === 'passing').length;
  const totalEndpoints = service.endpoints.length;

  return (
    <Card className={`p-4 transition-all hover:shadow-lg ${getStatusColor()}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <h3 className="font-semibold text-sm">{service.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                {getTypeIcon()}
                <span>{service.type.replace('_', ' ')}</span>
              </div>
              <Badge variant="outline" className={`text-xs ${getEnvironmentColor(service.environment)}`}>
                {service.environment}
              </Badge>
            </div>
          </div>
        </div>
        <Badge 
          variant="secondary" 
          className={`capitalize ${
            service.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
            service.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
            service.status === 'down' ? 'bg-red-500/20 text-red-400' :
            'bg-blue-500/20 text-blue-400'
          }`}
        >
          {service.status}
        </Badge>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-400">Uptime</p>
          <p className="text-sm font-semibold">{service.uptime.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Response Time</p>
          <p className="text-sm font-semibold">{service.responseTime}ms</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Error Rate</p>
          <p className="text-sm font-semibold">{service.errorRate.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Endpoints</p>
          <p className="text-sm font-semibold">
            {healthyEndpoints}/{totalEndpoints}
            {totalEndpoints > 0 && healthyEndpoints < totalEndpoints && (
              <AlertCircle className="inline h-3 w-3 text-yellow-500 ml-1" />
            )}
          </p>
        </div>
      </div>

      {/* Endpoint Status */}
      {service.endpoints.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Health Checks</span>
          </div>
          <div className="space-y-1">
            {service.endpoints.slice(0, 2).map((endpoint, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  {endpoint.status === 'passing' ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : endpoint.status === 'failing' ? (
                    <XCircle className="h-3 w-3 text-red-500" />
                  ) : (
                    <Clock className="h-3 w-3 text-gray-500" />
                  )}
                  <span className="text-gray-300">{endpoint.name}</span>
                </div>
                <span className="text-gray-400">{endpoint.responseTime}ms</span>
              </div>
            ))}
            {service.endpoints.length > 2 && (
              <p className="text-xs text-gray-400">
                +{service.endpoints.length - 2} more endpoints
              </p>
            )}
          </div>
        </div>
      )}

      {/* Last Checked */}
      <div className="mb-3">
        <p className="text-xs text-gray-400">
          Last checked {formatDistanceToNow(service.lastChecked, { addSuffix: true })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => onViewDetails(service.id)}
        >
          <Eye className="h-3 w-3 mr-1" />
          Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => onRunCheck(service.id)}
        >
          <Activity className="h-3 w-3 mr-1" />
          Check Now
        </Button>
      </div>
    </Card>
  );
}