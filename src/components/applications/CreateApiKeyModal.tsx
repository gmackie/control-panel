"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Copy, CheckCircle } from "lucide-react";
import { CreateApiKeyRequest } from "@/types/applications";

interface CreateApiKeyModalProps {
  applicationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateApiKeyModal({ applicationId, onClose, onSuccess }: CreateApiKeyModalProps) {
  const [formData, setFormData] = useState<CreateApiKeyRequest>({
    name: "",
    permissions: ["read"],
    expiresIn: "",
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: CreateApiKeyRequest) => {
      const response = await fetch(`/api/applications/${applicationId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create API key");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCreatedKey(data.key);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const copyToClipboard = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (createdKey) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const permissions = ["read", "write", "delete", "admin"];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {createdKey ? "API Key Created" : "Generate API Key"}
            </h2>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!createdKey ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Key Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                  placeholder="Production API Key"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Permissions
                </label>
                <div className="flex flex-wrap gap-2">
                  {permissions.map((perm) => (
                    <Badge
                      key={perm}
                      variant={formData.permissions?.includes(perm) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const current = formData.permissions || [];
                        if (current.includes(perm)) {
                          setFormData({
                            ...formData,
                            permissions: current.filter((p) => p !== perm),
                          });
                        } else {
                          setFormData({
                            ...formData,
                            permissions: [...current, perm],
                          });
                        }
                      }}
                    >
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Expiration (optional)
                </label>
                <select
                  value={formData.expiresIn}
                  onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Never expires</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                  <option value="1y">1 year</option>
                </select>
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
                  {createMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-green-950/20 border border-green-900 rounded-lg">
                <p className="text-sm text-green-400 mb-2">
                  Your API key has been created successfully!
                </p>
                <p className="text-xs text-gray-400">
                  Make sure to copy it now. You won&apos;t be able to see it again.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Your API Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-gray-900 border border-gray-800 rounded-md text-xs break-all">
                    {createdKey}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-800">
                <Button onClick={handleClose}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}