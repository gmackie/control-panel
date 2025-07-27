"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApps } from "@/lib/api";
import { AppService } from "@/types";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Zap,
  Database,
  Users,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

export default function AppServicesGrid() {
  const { data: services, isLoading } = useQuery<AppService[]>({
    queryKey: ["app-services"],
    queryFn: fetchApps,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-32 mb-3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-24"></div>
              <div className="h-4 bg-gray-700 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const statusIcon = {
    healthy: <CheckCircle className="h-5 w-5 text-green-500" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    unknown: <Activity className="h-5 w-5 text-gray-500" />,
  };

  const typeIcon = {
    nextjs: <Zap className="h-5 w-5 text-blue-500" />,
    "go-api": <Activity className="h-5 w-5 text-cyan-500" />,
    turso: <Database className="h-5 w-5 text-green-500" />,
    worker: <Activity className="h-5 w-5 text-purple-500" />,
  };

  const envColor = {
    production: "bg-red-900/20 text-red-400 border-red-900",
    staging: "bg-yellow-900/20 text-yellow-400 border-yellow-900",
    development: "bg-blue-900/20 text-blue-400 border-blue-900",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {services?.map((service) => (
        <div
          key={service.id}
          className="card hover:border-gray-700 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              {typeIcon[service.type]}
              <div>
                <h3 className="font-semibold">{service.name}</h3>
                <span
                  className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${
                    envColor[service.environment]
                  }`}
                >
                  {service.environment}
                </span>
              </div>
            </div>
            {statusIcon[service.status]}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Version</span>
              <span>{service.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Uptime</span>
              <span>{service.uptime}</span>
            </div>
            {service.metrics?.responseTime && (
              <div className="flex justify-between">
                <span className="text-gray-400">Response Time</span>
                <span>{service.metrics.responseTime.toFixed(0)}ms</span>
              </div>
            )}
            {service.metrics?.errorRate !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-400">Error Rate</span>
                <span
                  className={
                    service.metrics.errorRate > 1 ? "text-red-500" : ""
                  }
                >
                  {service.metrics.errorRate.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* Integrations */}
          {service.integrations && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2">Integrations</p>
              <div className="flex space-x-3">
                {service.integrations.stripe && (
                  <div className="flex items-center text-xs">
                    <CreditCard className="h-3 w-3 mr-1 text-blue-500" />
                    <span>Stripe</span>
                  </div>
                )}
                {service.integrations.turso && (
                  <div className="flex items-center text-xs">
                    <Database className="h-3 w-3 mr-1 text-green-500" />
                    <span>Turso</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {service.url && (
            <div className="mt-3">
              <Link
                href={service.url}
                target="_blank"
                className="text-blue-500 hover:text-blue-400 text-sm flex items-center"
              >
                View app
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
