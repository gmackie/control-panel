"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  Code,
  Smartphone,
  Server,
  ChevronLeft,
  Plus,
  Trash2,
  Activity,
  DollarSign,
  Users,
  AlertTriangle,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";

interface Application {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  appType: string;
  platform: string | null;
  status: string;
  createdAt: string;
  repositoryUrl: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  applications: Application[];
  applicationCount: number;
}

const APP_TYPE_ICONS: Record<string, React.ReactNode> = {
  web: <Code className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  api: <Server className="h-4 w-4" />,
  worker: <Server className="h-4 w-4" />,
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      return response.json();
    },
  });

  const { data: availableApps } = useQuery<Application[]>({
    queryKey: ["available-apps-for-product"],
    queryFn: async () => {
      const response = await fetch("/api/applications");
      if (!response.ok) throw new Error("Failed to fetch applications");
      const apps = await response.json();
      return Array.isArray(apps) ? apps : apps.applications || [];
    },
    enabled: showAddAppModal,
  });

  const addAppMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(`/api/products/${id}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add application");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowAddAppModal(false);
      setSelectedAppId("");
    },
  });

  const removeAppMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(`/api/products/${id}/applications?applicationId=${applicationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove application");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const getColorClass = (color: string | null) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      green: "bg-green-500/20 text-green-400 border-green-500/30",
      purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      pink: "bg-pink-500/20 text-pink-400 border-pink-500/30",
      cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      red: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return colorMap[color || "blue"] || colorMap.blue;
  };

  const unlinkedApps = availableApps?.filter(
    (app) => !product?.applications.find((pa) => pa.id === app.id)
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-40 bg-gray-800 rounded"></div>
          <div className="h-60 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Card className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Product not found</h3>
          <Link href="/products">
            <Button variant="outline">Back to Products</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/products">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Products
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg border ${getColorClass(product.color)}`}>
            <Package className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="text-gray-400">{product.description || product.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/products/${id}/dashboard`}>
            <Button variant="outline">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Badge variant={product.status === "active" ? "default" : "secondary"}>
            {product.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Code className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{product.applicationCount}</p>
              <p className="text-sm text-gray-400">Applications</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Activity className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-gray-400">Requests/min</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-gray-400">Active Users</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-gray-400">Monthly Cost</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Applications</h2>
            <Button onClick={() => setShowAddAppModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Application
            </Button>
          </div>

          {product.applications.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {product.applications.map((app) => (
                <Card key={app.id} className="p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-800 rounded-lg">
                        {APP_TYPE_ICONS[app.appType] || <Code className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="font-medium">{app.name}</h3>
                        <p className="text-sm text-gray-400">{app.appType} {app.platform && `(${app.platform})`}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                      onClick={() => {
                        if (confirm("Remove this application from the product?")) {
                          removeAppMutation.mutate(app.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {app.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{app.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{app.status}</Badge>
                    <Link href={`/applications/${app.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Code className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-2">No applications yet</h3>
              <p className="text-gray-400 mb-4">
                Add applications to this product to manage them together
              </p>
              <Button onClick={() => setShowAddAppModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Application
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="p-8 text-center">
            <Package className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-2">Product Integrations</h3>
            <p className="text-gray-400">
              Configure integrations shared across all applications in this product
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card className="p-8 text-center">
            <Activity className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-2">Combined Metrics</h3>
            <p className="text-gray-400">
              View aggregated metrics across all applications in this product
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="p-8 text-center">
            <Package className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-2">Product Settings</h3>
            <p className="text-gray-400">
              Configure product-level settings and preferences
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddAppModal} onOpenChange={setShowAddAppModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Application to Product</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedAppId} onValueChange={setSelectedAppId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an application..." />
              </SelectTrigger>
              <SelectContent>
                {unlinkedApps?.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name} ({app.slug})
                  </SelectItem>
                ))}
                {unlinkedApps?.length === 0 && (
                  <div className="p-2 text-sm text-gray-400 text-center">
                    No available applications
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAppModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedAppId && addAppMutation.mutate(selectedAppId)}
              disabled={!selectedAppId || addAppMutation.isPending}
            >
              {addAppMutation.isPending ? "Adding..." : "Add Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
