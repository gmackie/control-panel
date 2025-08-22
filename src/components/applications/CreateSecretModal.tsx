"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { CreateSecretRequest, INTEGRATION_TEMPLATES } from "@/types/applications";

interface CreateSecretModalProps {
  applicationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateSecretModal({ applicationId, onClose, onSuccess }: CreateSecretModalProps) {
  const [formData, setFormData] = useState<CreateSecretRequest>({
    key: "",
    value: "",
    description: "",
    category: "other",
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSecretRequest) => {
      const response = await fetch(`/api/applications/${applicationId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create secret");
      }
      
      return response.json();
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const categories = [
    { value: "database", label: "Database" },
    { value: "api", label: "API" },
    { value: "auth", label: "Authentication" },
    { value: "payment", label: "Payment" },
    { value: "storage", label: "Storage" },
    { value: "monitoring", label: "Monitoring" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Add Secret</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Key Name *
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none font-mono"
                placeholder="DATABASE_URL"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Use uppercase letters, numbers, and underscores
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Value *
              </label>
              <textarea
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none font-mono"
                placeholder="postgres://user:pass@host:5432/db"
                rows={3}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Provider (optional)
              </label>
              <input
                type="text"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                placeholder="stripe, supabase, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                placeholder="Brief description of this secret"
              />
            </div>

            {createMutation.error && (
              <div className="p-3 bg-red-950/20 border border-red-900 rounded-md text-sm text-red-400">
                {createMutation.error.message}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Secret"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}