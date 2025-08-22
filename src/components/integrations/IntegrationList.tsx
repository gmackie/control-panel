"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  TrashIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

interface Integration {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  healthStatus: string;
  lastChecked: string;
  createdAt: string;
}

interface IntegrationListProps {
  integrations: Integration[];
  onRefresh: () => void;
}

export default function IntegrationList({
  integrations,
  onRefresh,
}: IntegrationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "unhealthy":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case "warning":
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "unhealthy":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this integration?")) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/integrations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error deleting integration:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (integrations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No integrations
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by adding your first integration.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {integrations.map((integration) => (
          <li key={integration.id} className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {getStatusIcon(integration.healthStatus)}
                </div>
                <div className="ml-4">
                  <div className="flex items-center">
                    <p className="text-sm font-medium text-gray-900">
                      {integration.name}
                    </p>
                    <span
                      className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        integration.healthStatus
                      )}`}
                    >
                      {integration.healthStatus}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <span className="capitalize">{integration.provider}</span>
                    <span className="mx-1">•</span>
                    <span className="capitalize">{integration.type}</span>
                    <span className="mx-1">•</span>
                    <span>
                      Last checked:{" "}
                      {new Date(integration.lastChecked).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    /* TODO: Implement edit */
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(integration.id)}
                  disabled={deletingId === integration.id}
                  className="text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingId === integration.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  ) : (
                    <TrashIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
