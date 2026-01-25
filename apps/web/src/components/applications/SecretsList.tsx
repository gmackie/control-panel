"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  AlertCircle,
  Upload,
  Download,
  FileText,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Secret {
  id: string;
  name: string;
  environment: string;
  description?: string | null;
  maskedValue: string;
  isRotating?: boolean | null;
  lastRotatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

interface SecretsListProps {
  applicationId: string;
}

export function SecretsList({ applicationId }: SecretsListProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);

  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [secretEnvironment, setSecretEnvironment] = useState("all");
  const [secretDescription, setSecretDescription] = useState("");
  const [showSecretValue, setShowSecretValue] = useState(false);
  
  const [importContent, setImportContent] = useState("");
  const [importEnvironment, setImportEnvironment] = useState("all");
  const [importPreview, setImportPreview] = useState<Array<{ name: string; value: string }>>([]);

  const { data: secretsResponse, isLoading, error } = useQuery<{ success: boolean; data: Secret[]; count: number }>({
    queryKey: ["secrets", applicationId],
    queryFn: async () => {
      const response = await fetch(`/api/apps/${applicationId}/secrets`);
      if (!response.ok) throw new Error("Failed to fetch secrets");
      return response.json();
    },
  });

  const secrets = secretsResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; value: string; environment: string; description?: string }) => {
      const response = await fetch(`/api/apps/${applicationId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create secret");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
      resetForm();
      setShowCreateModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; value: string; environment: string; description?: string }) => {
      // Use POST for upsert (the API handles create or update)
      const response = await fetch(`/api/apps/${applicationId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update secret");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
      resetForm();
      setShowEditModal(false);
      setEditingSecret(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (secret: Secret) => {
      const response = await fetch(
        `/api/apps/${applicationId}/secrets?name=${encodeURIComponent(secret.name)}&environment=${encodeURIComponent(secret.environment)}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete secret");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
    },
  });

  const resetForm = () => {
    setSecretName("");
    setSecretValue("");
    setSecretEnvironment("all");
    setSecretDescription("");
    setShowSecretValue(false);
  };

  const handleEdit = (secret: Secret) => {
    setEditingSecret(secret);
    setSecretName(secret.name);
    setSecretValue(""); // Don't pre-fill value for security
    setSecretEnvironment(secret.environment);
    setSecretDescription(secret.description || "");
    setShowEditModal(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: secretName,
      value: secretValue,
      environment: secretEnvironment,
      description: secretDescription || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretValue.trim()) {
      // If no new value provided, we can't update
      return;
    }
    updateMutation.mutate({
      name: secretName,
      value: secretValue,
      environment: secretEnvironment,
      description: secretDescription || undefined,
    });
  };

  const copyToClipboard = (text: string, secretId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecretId(secretId);
    setTimeout(() => setCopiedSecretId(null), 2000);
  };

  const parseEnvContent = (content: string): Array<{ name: string; value: string }> => {
    const lines = content.split('\n');
    const result: Array<{ name: string; value: string }> = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        result.push({ name: match[1], value });
      }
    }
    return result;
  };

  const handleImportChange = (content: string) => {
    setImportContent(content);
    setImportPreview(parseEnvContent(content));
  };

  const importMutation = useMutation({
    mutationFn: async (entries: Array<{ name: string; value: string }>) => {
      const results = await Promise.all(
        entries.map(async (entry) => {
          const response = await fetch(`/api/apps/${applicationId}/secrets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: entry.name,
              value: entry.value,
              environment: importEnvironment,
            }),
          });
          return response.json();
        })
      );
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(`Failed to import ${failed.length} secrets`);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
      setImportContent("");
      setImportPreview([]);
      setShowImportModal(false);
    },
  });

  const exportAsEnv = () => {
    const envContent = secrets
      .map(s => `${s.name}=${s.maskedValue.includes('•') ? '# (hidden)' : s.maskedValue}`)
      .join('\n');
    
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${applicationId}.env`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case "production":
        return "error";
      case "staging":
        return "warning";
      case "development":
        return "info";
      case "all":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load secrets</h3>
          <p className="text-gray-400">{(error as Error).message}</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Secrets & Environment Variables</h2>
            <p className="text-sm text-gray-400 mt-1">
              Securely store API keys, tokens, and other sensitive data
            </p>
          </div>
          <div className="flex gap-2">
            {secrets.length > 0 && (
              <Button variant="outline" onClick={exportAsEnv} title="Export as .env">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Secret
            </Button>
          </div>
        </div>

        {secrets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell>
                    <div>
                      <code className="text-sm font-medium">{secret.name}</code>
                      {secret.description && (
                        <p className="text-xs text-gray-400 mt-1">{secret.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-900 px-2 py-1 rounded font-mono">
                        {secret.maskedValue || "••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(secret.name, secret.id)}
                        title="Copy secret name"
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
                    <Badge variant={getEnvironmentColor(secret.environment) as any}>
                      {secret.environment}
                    </Badge>
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
                        <DropdownMenuItem onClick={() => handleEdit(secret)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(secret)}
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

      {/* Create Secret Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Secret</DialogTitle>
            <DialogDescription>
              Create a new secret for your application. Secret values are encrypted at rest.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Secret Name</Label>
                <Input
                  id="name"
                  placeholder="MY_SECRET_KEY"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  className="font-mono"
                  required
                />
                <p className="text-xs text-gray-400">
                  Uppercase letters, numbers, and underscores only
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Secret Value</Label>
                <div className="relative">
                  <Input
                    id="value"
                    type={showSecretValue ? "text" : "password"}
                    placeholder="Enter secret value"
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    className="font-mono pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowSecretValue(!showSecretValue)}
                  >
                    {showSecretValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select value={secretEnvironment} onValueChange={setSecretEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="What this secret is used for"
                  value={secretDescription}
                  onChange={(e) => setSecretDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowCreateModal(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Secret"
                )}
              </Button>
            </DialogFooter>
            {createMutation.isError && (
              <p className="text-sm text-red-500 mt-2">
                {(createMutation.error as Error).message}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Secret Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Secret</DialogTitle>
            <DialogDescription>
              Update the secret value. You must provide a new value to save changes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Secret Name</Label>
                <Input
                  id="edit-name"
                  value={secretName}
                  disabled
                  className="font-mono bg-gray-900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-value">New Secret Value</Label>
                <div className="relative">
                  <Input
                    id="edit-value"
                    type={showSecretValue ? "text" : "password"}
                    placeholder="Enter new secret value"
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    className="font-mono pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowSecretValue(!showSecretValue)}
                  >
                    {showSecretValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  For security, you must enter a new value to update the secret
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-environment">Environment</Label>
                <Select value={secretEnvironment} onValueChange={setSecretEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Input
                  id="edit-description"
                  placeholder="What this secret is used for"
                  value={secretDescription}
                  onChange={(e) => setSecretDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowEditModal(false); setEditingSecret(null); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !secretValue.trim()}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Secret"
                )}
              </Button>
            </DialogFooter>
            {updateMutation.isError && (
              <p className="text-sm text-red-500 mt-2">
                {(updateMutation.error as Error).message}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import from .env
            </DialogTitle>
            <DialogDescription>
              Paste your .env file contents to bulk import secrets. Existing secrets with the same name will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="env-content">Environment File Contents</Label>
              <Textarea
                id="env-content"
                placeholder="DATABASE_URL=postgres://...&#10;API_KEY=sk_live_...&#10;SECRET_TOKEN=..."
                value={importContent}
                onChange={(e) => handleImportChange(e.target.value)}
                className="font-mono text-sm min-h-[200px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-environment">Target Environment</Label>
              <Select value={importEnvironment} onValueChange={setImportEnvironment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview ({importPreview.length} secrets found)</Label>
                <div className="max-h-[150px] overflow-y-auto border border-gray-800 rounded-lg p-2">
                  {importPreview.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-2 hover:bg-gray-900 rounded text-sm">
                      <code className="text-blue-400">{entry.name}</code>
                      <code className="text-gray-500 text-xs truncate max-w-[200px]">
                        {entry.value.length > 20 ? `${entry.value.slice(0, 20)}...` : entry.value}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { 
                setImportContent(""); 
                setImportPreview([]); 
                setShowImportModal(false); 
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => importMutation.mutate(importPreview)}
              disabled={importMutation.isPending || importPreview.length === 0}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {importPreview.length} Secrets
                </>
              )}
            </Button>
          </DialogFooter>
          {importMutation.isError && (
            <p className="text-sm text-red-500 mt-2">
              {(importMutation.error as Error).message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
