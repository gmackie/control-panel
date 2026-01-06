"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Package,
  Code,
  Smartphone,
  Server,
  ChevronRight,
  Clock,
  FolderKanban,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Application {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  appType: string;
  platform: string | null;
  status: string;
  createdAt: string;
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
  applications?: Application[];
  applicationCount?: number;
}

const APP_TYPE_ICONS: Record<string, React.ReactNode> = {
  web: <Code className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  api: <Server className="h-4 w-4" />,
  worker: <Server className="h-4 w-4" />,
};

const PRODUCT_COLORS = [
  "blue", "green", "purple", "orange", "pink", "cyan", "yellow", "red"
];

export default function ProductsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductColor, setNewProductColor] = useState("blue");
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("/api/products?includeApps=true");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; color: string }) => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description: string; color: string }) => {
      const response = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditingProduct(null);
      resetForm();
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const resetForm = () => {
    setNewProductName("");
    setNewProductDescription("");
    setNewProductColor("blue");
  };

  const handleCreateProduct = () => {
    if (!newProductName.trim()) return;
    createProductMutation.mutate({
      name: newProductName,
      description: newProductDescription,
      color: newProductColor,
    });
  };

  const handleUpdateProduct = () => {
    if (!editingProduct || !newProductName.trim()) return;
    updateProductMutation.mutate({
      id: editingProduct.id,
      name: newProductName,
      description: newProductDescription,
      color: newProductColor,
    });
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setNewProductName(product.name);
    setNewProductDescription(product.description || "");
    setNewProductColor(product.color || "blue");
  };

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

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Products</h1>
          <p className="text-gray-400">
            Organize applications into products for unified management and monitoring
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Product
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-800 rounded w-full"></div>
                <div className="h-20 bg-gray-800 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="p-6 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${getColorClass(product.color)}`}>
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-sm text-gray-400">{product.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={product.status === "active" ? "default" : "secondary"}>
                    {product.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(product)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this product? Applications will be unlinked but not deleted.")) {
                            deleteProductMutation.mutate(product.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {product.description && (
                <p className="text-sm text-gray-400 mb-4">{product.description}</p>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <FolderKanban className="h-4 w-4" />
                  <span>{product.applicationCount || 0} Applications</span>
                </div>
                
                {product.applications && product.applications.length > 0 ? (
                  <div className="space-y-2">
                    {product.applications.slice(0, 3).map((app) => (
                      <Link
                        key={app.id}
                        href={`/applications/${app.id}`}
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                      >
                        <div className="p-1.5 bg-gray-700 rounded">
                          {APP_TYPE_ICONS[app.appType] || <Code className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{app.name}</p>
                          <p className="text-xs text-gray-500">{app.appType} {app.platform && `(${app.platform})`}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {app.status}
                        </Badge>
                      </Link>
                    ))}
                    {product.applications.length > 3 && (
                      <p className="text-xs text-gray-500 pl-2">
                        +{product.applications.length - 3} more applications
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No applications linked yet</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Created {new Date(product.createdAt).toLocaleDateString()}</span>
                </div>
                <Link href={`/products/${product.id}`}>
                  <Button variant="ghost" size="sm" className="h-7">
                    View Details
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No products yet</h3>
          <p className="text-gray-400 mb-6">
            Create a product to group related applications together for unified management
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Product
          </Button>
        </Card>
      )}

      <Dialog open={showCreateModal || !!editingProduct} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingProduct(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Create New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="My Product"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="A collection of related applications..."
                value={newProductDescription}
                onChange={(e) => setNewProductDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                {PRODUCT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewProductColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      newProductColor === color ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: `var(--${color}-500, ${color})` }}
                  >
                    <span className={`block w-full h-full rounded-full bg-${color}-500`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingProduct(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingProduct ? handleUpdateProduct : handleCreateProduct}
              disabled={!newProductName.trim() || createProductMutation.isPending || updateProductMutation.isPending}
            >
              {createProductMutation.isPending || updateProductMutation.isPending
                ? "Saving..."
                : editingProduct
                ? "Update"
                : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
