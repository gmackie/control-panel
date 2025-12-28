"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface CreateIntegrationModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const INTEGRATION_TYPES = [
  {
    value: "stripe",
    label: "Stripe",
    description: "Payment processing and billing",
  },
  { value: "turso", label: "Turso", description: "SQLite database service" },
  {
    value: "webhook",
    label: "Webhook",
    description: "Custom webhook integration",
  },
  { value: "github", label: "GitHub", description: "Git repository and CI/CD" },
  { value: "slack", label: "Slack", description: "Team communication" },
  {
    value: "discord",
    label: "Discord",
    description: "Community communication",
  },
];

export default function CreateIntegrationModal({
  onClose,
  onSubmit,
}: CreateIntegrationModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    provider: "",
    config: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Error creating integration:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      type,
      provider: type,
      config: getDefaultConfig(type),
    }));
  };

  const getDefaultConfig = (type: string) => {
    switch (type) {
      case "stripe":
        return {
          apiKey: "",
          webhookSecret: "",
          environment: "test",
        };
      case "turso":
        return {
          databaseUrl: "",
          authToken: "",
          databaseName: "",
        };
      case "webhook":
        return {
          url: "",
          secret: "",
          events: [],
        };
      case "github":
        return {
          token: "",
          webhookSecret: "",
          events: ["push", "pull_request"],
        };
      case "slack":
        return {
          webhookUrl: "",
          channel: "",
          username: "",
        };
      case "discord":
        return {
          webhookUrl: "",
          channel: "",
          username: "",
        };
      default:
        return {};
    }
  };

  const renderConfigFields = () => {
    const config = formData.config as any;

    switch (formData.type) {
      case "stripe":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <input
                type="password"
                value={config.apiKey || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, apiKey: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="sk_test_..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Webhook Secret
              </label>
              <input
                type="password"
                value={config.webhookSecret || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, webhookSecret: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="whsec_..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Environment
              </label>
              <select
                value={config.environment || "test"}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, environment: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>
          </div>
        );

      case "turso":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Database URL
              </label>
              <input
                type="text"
                value={config.databaseUrl || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, databaseUrl: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="libsql://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Auth Token
              </label>
              <input
                type="password"
                value={config.authToken || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, authToken: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="eyJ..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Database Name
              </label>
              <input
                type="text"
                value={config.databaseName || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, databaseName: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="control-panel"
              />
            </div>
          </div>
        );

      case "webhook":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Webhook URL
              </label>
              <input
                type="url"
                value={config.url || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, url: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Secret
              </label>
              <input
                type="password"
                value={config.secret || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: { ...prev.config, secret: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="webhook_secret"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500">
            Configuration fields will appear here based on the integration type.
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Add Integration
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Integration Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="My Stripe Integration"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Integration Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              >
                <option value="">Select an integration type</option>
                {INTEGRATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {formData.type && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Configuration
                </label>
                <div className="mt-2 p-4 bg-gray-50 rounded-md">
                  {renderConfigFields()}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.name || !formData.type}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating..." : "Create Integration"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
