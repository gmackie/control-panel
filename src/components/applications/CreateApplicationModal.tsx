"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CreateApplicationRequest } from "@/types/applications";

interface CreateApplicationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateApplicationModal({ onClose, onSuccess }: CreateApplicationModalProps) {
  const [formData, setFormData] = useState<CreateApplicationRequest>({
    name: "",
    description: "",
    environment: "development",
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateApplicationRequest) => {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create application");
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Create Application</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Application Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                placeholder="My Awesome App"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                placeholder="Brief description of your application"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Environment
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                URL Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                placeholder="my-awesome-app (auto-generated if empty)"
              />
              <p className="text-xs text-gray-400 mt-1">
                URL-friendly identifier for your application
              </p>
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
                {createMutation.isPending ? "Creating..." : "Create Application"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}