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
  Shield,
  Plus,
  Eye,
  EyeOff,
  MoreVertical,
  Edit,
  Trash,
  Copy,
  CheckCircle,
} from "lucide-react";
import { ApplicationSecret } from "@/types/applications";
import { CreateSecretModal } from "./CreateSecretModal";

interface SecretsListProps {
  applicationId: string;
}

export function SecretsList({ applicationId }: SecretsListProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);

  const { data: secrets, isLoading } = useQuery<ApplicationSecret[]>({
    queryKey: ["secrets", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${applicationId}/secrets`);
      if (!response.ok) throw new Error("Failed to fetch secrets");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (secretId: string) => {
      const response = await fetch(
        `/api/applications/${applicationId}/secrets/${secretId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete secret");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
    },
  });

  const toggleSecretVisibility = (secretId: string) => {
    const newVisible = new Set(visibleSecrets);
    if (newVisible.has(secretId)) {
      newVisible.delete(secretId);
    } else {
      newVisible.add(secretId);
    }
    setVisibleSecrets(newVisible);
  };

  const copyToClipboard = (text: string, secretId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecretId(secretId);
    setTimeout(() => setCopiedSecretId(null), 2000);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "database":
        return "secondary";
      case "api":
        return "primary";
      case "auth":
        return "warning";
      case "payment":
        return "success";
      case "storage":
        return "info";
      case "monitoring":
        return "error";
      default:
        return "default";
    }
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
            <h2 className="text-xl font-semibold">Secrets</h2>
            <p className="text-sm text-gray-400 mt-1">
              Securely store API keys, tokens, and other sensitive data
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Secret
          </Button>
        </div>

        {secrets && secrets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell>
                    <div>
                      <code className="text-sm font-medium">{secret.key}</code>
                      {secret.description && (
                        <p className="text-xs text-gray-400 mt-1">{secret.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-900 px-2 py-1 rounded">
                        {visibleSecrets.has(secret.id) ? "••••••••" : "••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSecretVisibility(secret.id)}
                      >
                        {visibleSecrets.has(secret.id) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(secret.key, secret.id)}
                      >
                        {copiedSecretId === secret.id ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getCategoryColor(secret.category) as any}>
                      {secret.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {secret.provider ? (
                      <span className="text-sm">{secret.provider}</span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-400">
                      {new Date(secret.updatedAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(secret.id)}
                          className="text-red-500"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
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
            <Shield className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No secrets yet</h3>
            <p className="text-gray-400 mb-4">
              Add secrets to securely store sensitive configuration
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Secret
            </Button>
          </div>
        )}
      </Card>

      {showCreateModal && (
        <CreateSecretModal
          applicationId={applicationId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
          }}
        />
      )}
    </>
  );
}