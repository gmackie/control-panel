"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield,
  Key,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  Copy,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Settings,
  History
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Secret {
  id: string;
  name: string;
  type: 'api_key' | 'database' | 'certificate' | 'token' | 'credential' | 'ssh_key';
  environment: 'production' | 'staging' | 'development' | 'all';
  status: 'active' | 'expired' | 'rotating' | 'disabled';
  encrypted: boolean;
  value?: string;
  maskedValue: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  rotationEnabled: boolean;
  rotationInterval?: number;
  lastRotated?: Date;
  usedBy: string[];
  tags: string[];
  metadata: {
    description: string;
    owner: string;
    criticality: 'low' | 'medium' | 'high' | 'critical';
    compliance?: string[];
  };
}

interface SecretUsage {
  secretId: string;
  serviceId: string;
  serviceName: string;
  lastAccessed: Date;
  accessCount: number;
  status: 'active' | 'inactive';
}

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [secretUsage, setSecretUsage] = useState<SecretUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSecretsData();
  }, []);

  const fetchSecretsData = async () => {
    try {
      setIsLoading(true);
      const [secretsRes, usageRes] = await Promise.all([
        fetch('/api/secrets'),
        fetch('/api/secrets/usage')
      ]);
      
      const secretsData = await secretsRes.json();
      const usageData = await usageRes.json();
      
      setSecrets(secretsData.secrets || []);
      setSecretUsage(usageData.usage || []);
    } catch (error) {
      console.error('Error fetching secrets data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSecrets = secrets.filter(secret => {
    const matchesSearch = secret.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         secret.metadata.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEnvironment = selectedEnvironment === "all" || secret.environment === selectedEnvironment;
    const matchesType = selectedType === "all" || secret.type === selectedType;
    
    return matchesSearch && matchesEnvironment && matchesType;
  });

  const getStatusIcon = (status: Secret['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'rotating':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'disabled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: Secret['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'expired':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'rotating':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'disabled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getTypeIcon = (type: Secret['type']) => {
    switch (type) {
      case 'api_key':
        return <Key className="h-4 w-4" />;
      case 'database':
        return <Shield className="h-4 w-4" />;
      case 'certificate':
        return <Lock className="h-4 w-4" />;
      case 'token':
        return <Key className="h-4 w-4" />;
      case 'credential':
        return <Shield className="h-4 w-4" />;
      case 'ssh_key':
        return <Key className="h-4 w-4" />;
    }
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const toggleRevealSecret = (secretId: string) => {
    setRevealedSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(secretId)) {
        newSet.delete(secretId);
      } else {
        newSet.add(secretId);
      }
      return newSet;
    });
  };

  const isSecretRevealed = (secretId: string) => revealedSecrets.has(secretId);

  // Calculate summary stats
  const activeSecrets = secrets.filter(s => s.status === 'active').length;
  const expiredSecrets = secrets.filter(s => s.status === 'expired').length;
  const rotatingSecrets = secrets.filter(s => s.status === 'rotating').length;
  const criticalSecrets = secrets.filter(s => s.metadata.criticality === 'critical').length;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-500" />
            Secret Management
          </h1>
          <p className="text-gray-400 mt-1">
            Secure storage, rotation, and distribution of application secrets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchSecretsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Secret
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{activeSecrets}</p>
              <p className="text-sm text-gray-400">Active Secrets</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{expiredSecrets}</p>
              <p className="text-sm text-gray-400">Expired</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{rotatingSecrets}</p>
              <p className="text-sm text-gray-400">Rotating</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{criticalSecrets}</p>
              <p className="text-sm text-gray-400">Critical</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="vault" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vault">Vault</TabsTrigger>
          <TabsTrigger value="rotation">Rotation</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="vault" className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search secrets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-md"
                />
              </div>
              <select
                value={selectedEnvironment}
                onChange={(e) => setSelectedEnvironment(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
              >
                <option value="all">All Environments</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
              >
                <option value="all">All Types</option>
                <option value="api_key">API Keys</option>
                <option value="database">Database</option>
                <option value="certificate">Certificates</option>
                <option value="token">Tokens</option>
                <option value="credential">Credentials</option>
                <option value="ssh_key">SSH Keys</option>
              </select>
            </div>
          </Card>

          {/* Secrets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredSecrets.map(secret => (
              <Card key={secret.id} className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(secret.type)}
                    <div>
                      <h4 className="font-semibold">{secret.name}</h4>
                      <p className="text-xs text-gray-400">{secret.metadata.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(secret.status)}>
                      {getStatusIcon(secret.status)}
                      {secret.status}
                    </Badge>
                  </div>
                </div>

                {/* Secret Value */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-400">Value</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRevealSecret(secret.id)}
                      >
                        {isSecretRevealed(secret.id) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-900 p-2 rounded font-mono text-sm">
                    {isSecretRevealed(secret.id) ? secret.value || secret.maskedValue : secret.maskedValue}
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Environment</span>
                    <Badge variant="secondary" className="capitalize">{secret.environment}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Criticality</span>
                    <Badge variant="outline" className={getCriticalityColor(secret.metadata.criticality)}>
                      {secret.metadata.criticality}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Owner</span>
                    <span>{secret.metadata.owner}</span>
                  </div>
                  {secret.expiresAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Expires</span>
                      <span>{formatDistanceToNow(secret.expiresAt, { addSuffix: true })}</span>
                    </div>
                  )}
                </div>

                {/* Used By Services */}
                {secret.usedBy.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">Used by:</p>
                    <div className="flex flex-wrap gap-1">
                      {secret.usedBy.slice(0, 3).map(serviceId => (
                        <Badge key={serviceId} variant="secondary" className="text-xs">
                          {serviceId}
                        </Badge>
                      ))}
                      {secret.usedBy.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{secret.usedBy.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Rotation Status */}
                {secret.rotationEnabled && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Rotation</span>
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Every {secret.rotationInterval} days
                      </span>
                    </div>
                    {secret.lastRotated && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Last rotated</span>
                        <span>{formatDistanceToNow(secret.lastRotated, { addSuffix: true })}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {filteredSecrets.length === 0 && (
            <Card className="p-12 text-center">
              <Shield className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No secrets found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || selectedEnvironment !== 'all' || selectedType !== 'all' 
                  ? 'Try adjusting your search criteria'
                  : 'Add your first secret to get started'
                }
              </p>
              {!searchQuery && selectedEnvironment === 'all' && selectedType === 'all' && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Secret
                </Button>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rotation" className="space-y-4">
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Secret Rotation Management</h3>
            <p className="text-gray-400">Automated secret rotation and lifecycle management</p>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Secret Distribution</h3>
            <p className="text-gray-400">Secure distribution of secrets to services and environments</p>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="text-center py-8">
            <History className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Audit Log</h3>
            <p className="text-gray-400">Track all secret access and modification events</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}