"use client";

import { useState, useEffect, use } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Cloud,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Lock,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";

interface Secret {
  id: string;
  name: string;
  environment: string;
  description: string | null;
  maskedValue: string;
  isRotating: boolean | null;
  lastRotatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SecretsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const appId = resolvedParams.id;

  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Form state
  const [newSecret, setNewSecret] = useState({
    name: "",
    value: "",
    description: "",
    environment: "all",
  });
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSecrets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/apps/${appId}/secrets`);
      const data = await response.json();
      
      if (data.success) {
        setSecrets(data.data || []);
      } else {
        setError(data.error || "Failed to fetch secrets");
      }
    } catch (err) {
      setError("Failed to fetch secrets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, [appId]);

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSecret.name || !newSecret.value) {
      setError("Name and value are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch(`/api/apps/${appId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSecret),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNewSecret({ name: "", value: "", description: "", environment: "all" });
        setShowAddForm(false);
        fetchSecrets();
      } else {
        setError(data.error || "Failed to save secret");
      }
    } catch (err) {
      setError("Failed to save secret");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSecret = async (secretName: string, environment: string) => {
    if (!confirm(`Are you sure you want to delete ${secretName}?`)) {
      return;
    }

    try {
      setDeleting(secretName);
      
      const response = await fetch(
        `/api/apps/${appId}/secrets?name=${encodeURIComponent(secretName)}&environment=${environment}`,
        { method: "DELETE" }
      );
      
      const data = await response.json();
      
      if (data.success) {
        fetchSecrets();
      } else {
        setError(data.error || "Failed to delete secret");
      }
    } catch (err) {
      setError("Failed to delete secret");
    } finally {
      setDeleting(null);
    }
  };

  const handleSync = async (target: "k8s" | "gitea" | "both") => {
    try {
      setSyncing(true);
      setError(null);
      
      const targets = target === "both" ? ["k8s", "gitea"] : [target];
      
      const response = await fetch(`/api/apps/${appId}/secrets/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.message || "Sync failed");
      }
    } catch (err) {
      setError("Failed to sync secrets");
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case "production":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "staging":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "development":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/applications/${appId}/dashboard`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="h-6 w-6" />
              Secrets Management
            </h1>
            <p className="text-gray-400 text-sm">
              Manage encrypted secrets for your application
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync("k8s")}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4 mr-2" />
            )}
            Sync to K8s
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync("gitea")}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4 mr-2" />
            )}
            Sync to Gitea
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Secret
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-950/20 border border-red-900 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <div>
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-400/70 hover:text-red-400 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Add Secret Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Secret</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSecret} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={newSecret.name}
                    onChange={(e) => setNewSecret({ 
                      ...newSecret, 
                      name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") 
                    })}
                    placeholder="API_KEY"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Uppercase with underscores</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Environment</label>
                  <select
                    value={newSecret.environment}
                    onChange={(e) => setNewSecret({ ...newSecret, environment: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Environments</option>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Value *</label>
                <div className="relative">
                  <input
                    type={showValue ? "text" : "password"}
                    value={newSecret.value}
                    onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                    placeholder="Enter secret value"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue(!showValue)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={newSecret.description}
                  onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSecret({ name: "", value: "", description: "", environment: "all" });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Save Secret
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Secrets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Secrets ({secrets.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchSecrets} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : secrets.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No secrets configured</p>
              <p className="text-sm text-gray-500 mt-1">
                Add secrets to securely store API keys and credentials
              </p>
              <Button className="mt-4" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Secret
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret) => (
                <div
                  key={secret.id}
                  className="p-4 bg-gray-900/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium">{secret.name}</span>
                        <Badge variant="outline" className={getEnvironmentColor(secret.environment)}>
                          {secret.environment}
                        </Badge>
                        {secret.isRotating && (
                          <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Rotating
                          </Badge>
                        )}
                      </div>
                      
                      {secret.description && (
                        <p className="text-sm text-gray-400 mb-2">{secret.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created: {new Date(secret.createdAt).toLocaleDateString()}</span>
                        {secret.lastRotatedAt && (
                          <span>Rotated: {new Date(secret.lastRotatedAt).toLocaleDateString()}</span>
                        )}
                        {secret.expiresAt && (
                          <span className="text-yellow-400">
                            Expires: {new Date(secret.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(secret.name, secret.id)}
                        className="p-2 hover:bg-gray-800 rounded"
                        title="Copy name"
                      >
                        {copiedId === secret.id ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteSecret(secret.name, secret.environment)}
                        disabled={deleting === secret.name}
                        className="p-2 hover:bg-red-900/20 rounded text-gray-400 hover:text-red-400"
                        title="Delete secret"
                      >
                        {deleting === secret.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Security Information</p>
              <ul className="text-sm text-gray-400 mt-1 space-y-1">
                <li>- Secrets are encrypted with AES-256-GCM before storage</li>
                <li>- Values are never displayed in the UI after creation</li>
                <li>- Syncing creates Kubernetes Secrets in your app namespace</li>
                <li>- Gitea sync sets repository secrets for CI/CD workflows</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
