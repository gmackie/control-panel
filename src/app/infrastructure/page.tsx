"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InfrastructureSwitcher } from "@/components/infrastructure/InfrastructureSwitcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Server,
  GitBranch,
  Plus,
  Activity,
  DollarSign,
  Shield,
  Settings,
  AlertCircle,
} from "lucide-react";
import { Infrastructure } from "@/lib/infrastructure/types";

export default function InfrastructurePage() {
  const router = useRouter();
  const [selectedInfra, setSelectedInfra] = useState<Infrastructure>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<"k3s" | "gitea-vps">();

  const handleInfraSelect = (infrastructure: Infrastructure) => {
    setSelectedInfra(infrastructure);
  };

  const handleCreateNew = () => {
    setShowCreateDialog(true);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Infrastructure Management</h1>
        <p className="text-gray-400">
          Manage your K3s clusters and Gitea VPS instances in one place
        </p>
      </div>

      <InfrastructureSwitcher
        selectedId={selectedInfra?.id}
        onSelect={handleInfraSelect}
        onCreateNew={handleCreateNew}
      />

      {selectedInfra && (
        <div className="mt-8">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Type</span>
                    {selectedInfra.type === "k3s" ? (
                      <Server className="h-4 w-4 text-gray-400" />
                    ) : (
                      <GitBranch className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-2xl font-bold capitalize">
                    {selectedInfra.type.replace("-", " ")}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Status</span>
                    <Activity className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold capitalize">
                    {selectedInfra.status}
                  </p>
                </Card>

                {selectedInfra.resources && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Resources</span>
                      <Server className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-2xl font-bold">
                      {selectedInfra.resources.nodes}{" "}
                      {selectedInfra.resources.nodes === 1 ? "Node" : "Nodes"}
                    </p>
                  </Card>
                )}

                {selectedInfra.cost && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Monthly Cost</span>
                      <DollarSign className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-2xl font-bold">
                      ${selectedInfra.cost.monthly.toFixed(2)}
                    </p>
                  </Card>
                )}
              </div>

              {selectedInfra.type === "k3s" && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">K3s Cluster Features</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedInfra.config.type === "k3s" && (
                      <>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <Shield className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                          <p className="font-medium">Autoscaling</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.autoscaling
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <Activity className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <p className="font-medium">Monitoring</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.monitoring
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <Server className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                          <p className="font-medium">Registry</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.registry
                              ? "Harbor"
                              : "None"}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                          <p className="font-medium">Ingress</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.ingress
                              ? "Traefik"
                              : "None"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              )}

              {selectedInfra.type === "gitea-vps" && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Gitea VPS Features</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedInfra.config.type === "gitea-vps" && (
                      <>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <Activity className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                          <p className="font-medium">Actions</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.actions
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <Server className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <p className="font-medium">Registry</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.registry
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <Shield className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                          <p className="font-medium">Packages</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.packages
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-900 rounded">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                          <p className="font-medium">LFS</p>
                          <p className="text-sm text-gray-400">
                            {selectedInfra.config.features.lfs
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    if (selectedInfra.type === "k3s") {
                      router.push("/cluster");
                    } else {
                      window.open(selectedInfra.endpoint, "_blank");
                    }
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage {selectedInfra.type === "k3s" ? "Cluster" : "Gitea"}
                </Button>
                <Button variant="outline">View Logs</Button>
                <Button variant="outline" className="text-red-500">
                  Delete Infrastructure
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="applications">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Applications running on this infrastructure
                </h3>
                <p className="text-gray-400">
                  Application list will be displayed here
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="resources">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Resource Usage</h3>
                <p className="text-gray-400">
                  Resource metrics will be displayed here
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
                <p className="text-gray-400">
                  Security configuration will be displayed here
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Infrastructure Settings
                </h3>
                <p className="text-gray-400">
                  Settings and configuration will be displayed here
                </p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Create Infrastructure Dialog */}
      {showCreateDialog && <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Infrastructure</DialogTitle>
            <DialogDescription>
              Choose the type of infrastructure you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card
              className={`p-6 cursor-pointer transition-all ${
                createType === "k3s"
                  ? "ring-2 ring-blue-500"
                  : "hover:ring-1 hover:ring-gray-600"
              }`}
              onClick={() => setCreateType("k3s")}
            >
              <Server className="h-12 w-12 mb-3 text-blue-500" />
              <h3 className="font-semibold mb-1">K3s Cluster</h3>
              <p className="text-sm text-gray-400">
                Lightweight Kubernetes for production workloads
              </p>
            </Card>
            <Card
              className={`p-6 cursor-pointer transition-all ${
                createType === "gitea-vps"
                  ? "ring-2 ring-blue-500"
                  : "hover:ring-1 hover:ring-gray-600"
              }`}
              onClick={() => setCreateType("gitea-vps")}
            >
              <GitBranch className="h-12 w-12 mb-3 text-green-500" />
              <h3 className="font-semibold mb-1">Gitea VPS</h3>
              <p className="text-sm text-gray-400">
                Self-hosted Git service with CI/CD
              </p>
            </Card>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setCreateType(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!createType}
              onClick={() => {
                // TODO: Navigate to create page with type
                setShowCreateDialog(false);
                router.push(`/infrastructure/create?type=${createType}`);
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}