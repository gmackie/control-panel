"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Server,
  GitBranch,
  ArrowLeft,
  Plus,
  Download,
  Check,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";

type CreateMode = "create" | "import";
type InfraType = "k3s" | "gitea-vps";

interface K3sCreateConfig {
  clusterName: string;
  masterNodes: number;
  workerNodes: number;
  serverType: string;
  location: string;
  features: {
    autoscaling: boolean;
    monitoring: boolean;
    registry: boolean;
    ingress: boolean;
  };
}

interface K3sImportConfig {
  name: string;
  kubeconfig?: string;
  apiEndpoint?: string;
  apiToken?: string;
  description?: string;
}

interface GiteaCreateConfig {
  serverName: string;
  serverType: string;
  location: string;
  domain: string;
  features: {
    actions: boolean;
    registry: boolean;
    packages: boolean;
    lfs: boolean;
  };
}

const HETZNER_SERVER_TYPES = [
  { value: "cx22", label: "CX22 - 2 vCPU, 4GB RAM, 40GB SSD", price: "4.49" },
  { value: "cx32", label: "CX32 - 4 vCPU, 8GB RAM, 80GB SSD", price: "9.49" },
  { value: "cx42", label: "CX42 - 8 vCPU, 16GB RAM, 160GB SSD", price: "18.49" },
  { value: "cx52", label: "CX52 - 16 vCPU, 32GB RAM, 320GB SSD", price: "35.49" },
];

const HETZNER_LOCATIONS = [
  { value: "nbg1", label: "Nuremberg, Germany" },
  { value: "fsn1", label: "Falkenstein, Germany" },
  { value: "hel1", label: "Helsinki, Finland" },
  { value: "ash", label: "Ashburn, USA" },
  { value: "hil", label: "Hillsboro, USA" },
];

function CreateInfrastructureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as InfraType | null;

  const [activeTab, setActiveTab] = useState<CreateMode>("create");
  const [infraType, setInfraType] = useState<InfraType>(typeParam || "k3s");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const [k3sCreateConfig, setK3sCreateConfig] = useState<K3sCreateConfig>({
    clusterName: "",
    masterNodes: 1,
    workerNodes: 1,
    serverType: "cx22",
    location: "nbg1",
    features: {
      autoscaling: false,
      monitoring: true,
      registry: false,
      ingress: true,
    },
  });

  const [k3sImportConfig, setK3sImportConfig] = useState<K3sImportConfig>({
    name: "",
    kubeconfig: "",
    apiEndpoint: "",
    apiToken: "",
    description: "",
  });

  const [giteaConfig, setGiteaConfig] = useState<GiteaCreateConfig>({
    serverName: "",
    serverType: "cx22",
    location: "nbg1",
    domain: "",
    features: {
      actions: true,
      registry: true,
      packages: true,
      lfs: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { type: string; config: any }) => {
      const response = await fetch("/api/infrastructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create infrastructure");
      }
      return response.json();
    },
    onSuccess: () => {
      router.push("/infrastructure");
    },
  });

  const importMutation = useMutation({
    mutationFn: async (payload: { type: string; config: any }) => {
      const response = await fetch("/api/infrastructure/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import infrastructure");
      }
      return response.json();
    },
    onSuccess: () => {
      router.push("/infrastructure");
    },
  });

  const validateConnection = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch("/api/infrastructure/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: infraType,
          kubeconfig: k3sImportConfig.kubeconfig,
          apiEndpoint: k3sImportConfig.apiEndpoint,
          apiToken: k3sImportConfig.apiToken,
        }),
      });

      const result = await response.json();
      setValidationResult({
        success: response.ok,
        message: result.message || (response.ok ? "Connection successful!" : "Connection failed"),
        details: result.details,
      });
    } catch (error: any) {
      setValidationResult({
        success: false,
        message: error.message || "Failed to validate connection",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleCreate = () => {
    if (infraType === "k3s") {
      createMutation.mutate({
        type: "k3s",
        config: k3sCreateConfig,
      });
    } else {
      createMutation.mutate({
        type: "gitea-vps",
        config: giteaConfig,
      });
    }
  };

  const handleImport = () => {
    importMutation.mutate({
      type: "k3s-imported",
      config: k3sImportConfig,
    });
  };

  const calculateEstimatedCost = (): number => {
    const serverPrice = HETZNER_SERVER_TYPES.find(
      (s) => s.value === (infraType === "k3s" ? k3sCreateConfig.serverType : giteaConfig.serverType)
    );
    if (!serverPrice) return 0;

    if (infraType === "k3s") {
      const totalNodes = k3sCreateConfig.masterNodes + k3sCreateConfig.workerNodes;
      return parseFloat(serverPrice.price) * totalNodes;
    }
    return parseFloat(serverPrice.price);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/infrastructure")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Infrastructure
        </Button>
        <h1 className="text-3xl font-bold mb-2">Add Infrastructure</h1>
        <p className="text-gray-400">
          Create new infrastructure or import an existing cluster
        </p>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Infrastructure Type</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card
            className={`p-6 cursor-pointer transition-all ${
              infraType === "k3s"
                ? "ring-2 ring-blue-500 bg-blue-500/10"
                : "hover:ring-1 hover:ring-gray-600"
            }`}
            onClick={() => setInfraType("k3s")}
          >
            <Server className="h-10 w-10 mb-3 text-blue-500" />
            <h3 className="font-semibold mb-1">K3s Cluster</h3>
            <p className="text-sm text-gray-400">
              Lightweight Kubernetes for production workloads
            </p>
          </Card>
          <Card
            className={`p-6 cursor-pointer transition-all ${
              infraType === "gitea-vps"
                ? "ring-2 ring-green-500 bg-green-500/10"
                : "hover:ring-1 hover:ring-gray-600"
            }`}
            onClick={() => {
              setInfraType("gitea-vps");
              setActiveTab("create");
            }}
          >
            <GitBranch className="h-10 w-10 mb-3 text-green-500" />
            <h3 className="font-semibold mb-1">Gitea VPS</h3>
            <p className="text-sm text-gray-400">
              Self-hosted Git service with CI/CD
            </p>
          </Card>
        </div>
      </Card>

      {infraType === "k3s" && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CreateMode)} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Import Existing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Create K3s Cluster</h2>
              <p className="text-sm text-gray-400 mb-6">
                Provision a new K3s cluster on Hetzner Cloud. The cluster will be automatically
                configured and managed.
              </p>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clusterName">Cluster Name</Label>
                    <Input
                      id="clusterName"
                      placeholder="my-k3s-cluster"
                      value={k3sCreateConfig.clusterName}
                      onChange={(e) =>
                        setK3sCreateConfig({ ...k3sCreateConfig, clusterName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select
                      value={k3sCreateConfig.location}
                      onValueChange={(v) =>
                        setK3sCreateConfig({ ...k3sCreateConfig, location: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HETZNER_LOCATIONS.map((loc) => (
                          <SelectItem key={loc.value} value={loc.value}>
                            {loc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serverType">Server Type</Label>
                  <Select
                    value={k3sCreateConfig.serverType}
                    onValueChange={(v) =>
                      setK3sCreateConfig({ ...k3sCreateConfig, serverType: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HETZNER_SERVER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label} - EUR {type.price}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="masterNodes">Master Nodes</Label>
                    <Select
                      value={k3sCreateConfig.masterNodes.toString()}
                      onValueChange={(v) =>
                        setK3sCreateConfig({ ...k3sCreateConfig, masterNodes: parseInt(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (Single Master)</SelectItem>
                        <SelectItem value="3">3 (HA Cluster)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workerNodes">Worker Nodes</Label>
                    <Select
                      value={k3sCreateConfig.workerNodes.toString()}
                      onValueChange={(v) =>
                        setK3sCreateConfig({ ...k3sCreateConfig, workerNodes: parseInt(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} Worker{n !== 1 ? "s" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Features</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                      <div>
                        <p className="font-medium">Autoscaling</p>
                        <p className="text-sm text-gray-400">Auto-scale nodes based on load</p>
                      </div>
                      <Switch
                        checked={k3sCreateConfig.features.autoscaling}
                        onCheckedChange={(v) =>
                          setK3sCreateConfig({
                            ...k3sCreateConfig,
                            features: { ...k3sCreateConfig.features, autoscaling: v },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                      <div>
                        <p className="font-medium">Monitoring</p>
                        <p className="text-sm text-gray-400">Prometheus + Grafana</p>
                      </div>
                      <Switch
                        checked={k3sCreateConfig.features.monitoring}
                        onCheckedChange={(v) =>
                          setK3sCreateConfig({
                            ...k3sCreateConfig,
                            features: { ...k3sCreateConfig.features, monitoring: v },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                      <div>
                        <p className="font-medium">Registry</p>
                        <p className="text-sm text-gray-400">Built-in container registry</p>
                      </div>
                      <Switch
                        checked={k3sCreateConfig.features.registry}
                        onCheckedChange={(v) =>
                          setK3sCreateConfig({
                            ...k3sCreateConfig,
                            features: { ...k3sCreateConfig.features, registry: v },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                      <div>
                        <p className="font-medium">Ingress</p>
                        <p className="text-sm text-gray-400">Traefik ingress controller</p>
                      </div>
                      <Switch
                        checked={k3sCreateConfig.features.ingress}
                        onCheckedChange={(v) =>
                          setK3sCreateConfig({
                            ...k3sCreateConfig,
                            features: { ...k3sCreateConfig.features, ingress: v },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Card className="p-4 bg-gray-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Estimated Monthly Cost</p>
                      <p className="text-2xl font-bold">EUR {calculateEstimatedCost().toFixed(2)}</p>
                    </div>
                    <Badge variant="secondary">
                      {k3sCreateConfig.masterNodes + k3sCreateConfig.workerNodes} nodes
                    </Badge>
                  </div>
                </Card>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Import Existing Cluster</h2>
              <p className="text-sm text-gray-400 mb-6">
                Import an existing Kubernetes cluster by providing a kubeconfig file or API
                credentials. The cluster will be added to the control panel for monitoring only -
                no provisioning or node management will be available.
              </p>

              <Alert className="mb-6">
                <Info className="h-4 w-4" />
                <AlertTitle>Import Mode</AlertTitle>
                <AlertDescription>
                  Imported clusters are read-only. You can monitor deployments and resources, but
                  cannot provision new nodes or manage cluster settings.
                </AlertDescription>
              </Alert>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="importName">Cluster Name</Label>
                  <Input
                    id="importName"
                    placeholder="production-cluster"
                    value={k3sImportConfig.name}
                    onChange={(e) =>
                      setK3sImportConfig({ ...k3sImportConfig, name: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    A friendly name to identify this cluster in the dashboard
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="Main production cluster on Hetzner"
                    value={k3sImportConfig.description}
                    onChange={(e) =>
                      setK3sImportConfig({ ...k3sImportConfig, description: e.target.value })
                    }
                  />
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="font-medium mb-4">Connection Method</h3>
                  
                  <Tabs defaultValue="kubeconfig" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="kubeconfig">Kubeconfig File</TabsTrigger>
                      <TabsTrigger value="token">API Token</TabsTrigger>
                    </TabsList>

                    <TabsContent value="kubeconfig">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="kubeconfig">Kubeconfig Contents</Label>
                          <Textarea
                            id="kubeconfig"
                            placeholder="Paste your kubeconfig YAML here..."
                            className="font-mono text-sm h-64"
                            value={k3sImportConfig.kubeconfig}
                            onChange={(e) =>
                              setK3sImportConfig({ ...k3sImportConfig, kubeconfig: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500">
                            The kubeconfig will be encrypted and stored securely
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="token">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="apiEndpoint">API Endpoint</Label>
                          <Input
                            id="apiEndpoint"
                            placeholder="https://your-cluster.example.com:6443"
                            value={k3sImportConfig.apiEndpoint}
                            onChange={(e) =>
                              setK3sImportConfig({ ...k3sImportConfig, apiEndpoint: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="apiToken">Service Account Token</Label>
                          <Textarea
                            id="apiToken"
                            placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
                            className="font-mono text-sm h-32"
                            value={k3sImportConfig.apiToken}
                            onChange={(e) =>
                              setK3sImportConfig({ ...k3sImportConfig, apiToken: e.target.value })
                            }
                          />
                          <p className="text-xs text-gray-500">
                            A service account token with cluster-reader permissions
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {validationResult && (
                  <Alert variant={validationResult.success ? "default" : "destructive"}>
                    {validationResult.success ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {validationResult.success ? "Connection Successful" : "Connection Failed"}
                    </AlertTitle>
                    <AlertDescription>
                      {validationResult.message}
                      {validationResult.details && (
                        <div className="mt-2 text-sm">
                          <p>Nodes: {validationResult.details.nodes}</p>
                          <p>Version: {validationResult.details.version}</p>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={validateConnection}
                    disabled={
                      isValidating ||
                      (!k3sImportConfig.kubeconfig &&
                        (!k3sImportConfig.apiEndpoint || !k3sImportConfig.apiToken))
                    }
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {infraType === "gitea-vps" && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Gitea VPS</h2>
          <p className="text-sm text-gray-400 mb-6">
            Provision a new Gitea server on Hetzner Cloud with CI/CD capabilities.
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serverName">Server Name</Label>
                <Input
                  id="serverName"
                  placeholder="gitea-server"
                  value={giteaConfig.serverName}
                  onChange={(e) => setGiteaConfig({ ...giteaConfig, serverName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  placeholder="git.example.com"
                  value={giteaConfig.domain}
                  onChange={(e) => setGiteaConfig({ ...giteaConfig, domain: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="giteaServerType">Server Type</Label>
                <Select
                  value={giteaConfig.serverType}
                  onValueChange={(v) => setGiteaConfig({ ...giteaConfig, serverType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HETZNER_SERVER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} - EUR {type.price}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="giteaLocation">Location</Label>
                <Select
                  value={giteaConfig.location}
                  onValueChange={(v) => setGiteaConfig({ ...giteaConfig, location: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HETZNER_LOCATIONS.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <div>
                    <p className="font-medium">Gitea Actions</p>
                    <p className="text-sm text-gray-400">Built-in CI/CD</p>
                  </div>
                  <Switch
                    checked={giteaConfig.features.actions}
                    onCheckedChange={(v) =>
                      setGiteaConfig({
                        ...giteaConfig,
                        features: { ...giteaConfig.features, actions: v },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <div>
                    <p className="font-medium">Container Registry</p>
                    <p className="text-sm text-gray-400">Docker images</p>
                  </div>
                  <Switch
                    checked={giteaConfig.features.registry}
                    onCheckedChange={(v) =>
                      setGiteaConfig({
                        ...giteaConfig,
                        features: { ...giteaConfig.features, registry: v },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <div>
                    <p className="font-medium">Packages</p>
                    <p className="text-sm text-gray-400">npm, Maven, NuGet, etc.</p>
                  </div>
                  <Switch
                    checked={giteaConfig.features.packages}
                    onCheckedChange={(v) =>
                      setGiteaConfig({
                        ...giteaConfig,
                        features: { ...giteaConfig.features, packages: v },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <div>
                    <p className="font-medium">Git LFS</p>
                    <p className="text-sm text-gray-400">Large file storage</p>
                  </div>
                  <Switch
                    checked={giteaConfig.features.lfs}
                    onCheckedChange={(v) =>
                      setGiteaConfig({
                        ...giteaConfig,
                        features: { ...giteaConfig.features, lfs: v },
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <Card className="p-4 bg-gray-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Estimated Monthly Cost</p>
                  <p className="text-2xl font-bold">EUR {calculateEstimatedCost().toFixed(2)}</p>
                </div>
                <Badge variant="secondary">1 server</Badge>
              </div>
            </Card>
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.push("/infrastructure")}>
          Cancel
        </Button>
        {activeTab === "create" ? (
          <Button
            onClick={handleCreate}
            disabled={
              createMutation.isPending ||
              (infraType === "k3s" && !k3sCreateConfig.clusterName) ||
              (infraType === "gitea-vps" && (!giteaConfig.serverName || !giteaConfig.domain))
            }
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Infrastructure
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleImport}
            disabled={
              importMutation.isPending ||
              !k3sImportConfig.name ||
              (!k3sImportConfig.kubeconfig &&
                (!k3sImportConfig.apiEndpoint || !k3sImportConfig.apiToken))
            }
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import Cluster
              </>
            )}
          </Button>
        )}
      </div>

      {(createMutation.error || importMutation.error) && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {(createMutation.error as Error)?.message ||
              (importMutation.error as Error)?.message ||
              "An error occurred"}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-800 rounded w-1/4"></div>
        <div className="h-4 bg-gray-800 rounded w-1/2"></div>
        <div className="h-64 bg-gray-800 rounded"></div>
      </div>
    </div>
  );
}

export default function CreateInfrastructurePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CreateInfrastructureContent />
    </Suspense>
  );
}
