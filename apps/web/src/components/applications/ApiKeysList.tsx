"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Key,
  Plus,
  Copy,
  MoreVertical,
  Trash,
  CheckCircle,
  Clock,
  Ban,
} from "lucide-react";
import { ApiKey, CreateApiKeyRequest } from "@/types/applications";
import { CreateApiKeyModal } from "./CreateApiKeyModal";

interface ApiKeysListProps {
  applicationId: string;
}

export function ApiKeysList({ applicationId }: ApiKeysListProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["api-keys", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}/api-keys`);
      if (!response.ok) throw new Error("Failed to fetch API keys");
      return response.json();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(
        `/api/applications/${applicationId}/api-keys/${keyId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to revoke API key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", applicationId] });
    },
  });

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-32 bg-gray-800 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">API Keys</h2>
            <p className="text-sm text-gray-400 mt-1">
              Manage API keys for authenticating with your application
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate API Key
          </Button>
        </div>

        {apiKeys && apiKeys.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-900 px-2 py-1 rounded">
                        {key.prefix}...
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(key.prefix + "...", key.id)}
                      >
                        {copiedKeyId === key.id ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {key.permissions.map((perm) => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {key.lastUsedAt ? (
                      <span className="text-sm text-gray-400">
                        {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {key.expiresAt ? (
                      <span className="text-sm text-gray-400">
                        {new Date(key.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {key.isActive ? (
                      <Badge variant="success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="error">
                        <Ban className="h-3 w-3 mr-1" />
                        Revoked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => revokeMutation.mutate(key.id)}
                          className="text-red-500"
                          disabled={!key.isActive}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Revoke Key
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Key className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
            <p className="text-gray-400 mb-4">
              Generate API keys to authenticate with your application
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Your First Key
            </Button>
          </div>
        )}
      </Card>

      {showCreateModal && (
        <CreateApiKeyModal
          applicationId={applicationId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["api-keys", applicationId] });
          }}
        />
      )}
    </>
  );
}