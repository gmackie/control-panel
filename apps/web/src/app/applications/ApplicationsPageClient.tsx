"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Code,
  Key,
  Shield,
  Globe,
  Clock,
  Download,
  LayoutDashboard,
  ChevronRight,
  Sparkles,
  Search,
  X,
  LayoutGrid,
  List,
  Filter,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Application } from "@/types/applications";
import { AppCreationWizard } from "@/components/applications/AppCreationWizard";
import { ImportAppWizard } from "@/components/applications/ImportAppWizard";
import { K8sImportWizard } from "@/components/applications/K8sImportWizard";
import { ProviderBadges } from "@/components/applications/ProviderBadges";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "list";
type ProductFilter = "all" | "unassigned" | string;

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
}

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

function isViewMode(value: string | null): value is ViewMode {
  return value === "cards" || value === "list";
}

export default function ApplicationsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openApplication = (slug: string) => {
    router.push(`/applications/${encodeURIComponent(slug)}`);
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showK8sImportModal, setShowK8sImportModal] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");

  const urlView = searchParams.get("view");
  const urlQ = searchParams.get("q") ?? "";
  const urlProduct = searchParams.get("product") ?? "all";

  const setUrlParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const { data: applications, isLoading, refetch } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: async () => {
      const response = await fetch("/api/applications");
      if (!response.ok) throw new Error("Failed to fetch applications");
      const data = await response.json();
      // Handle both formats: array or { applications: [...] }
      return Array.isArray(data) ? data : (data.applications || []);
    },
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Initialize URL-driven state and support back/forward navigation.
  useEffect(() => {
    if (isViewMode(urlView)) {
      setViewMode(urlView);
      return;
    }

    // URL param absent or invalid; default from localStorage.
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("applications.view") : null;
    const storedView = stored === "list" || stored === "cards" ? stored : null;
    const next = storedView ?? "cards";
    setViewMode(next);
    setUrlParam("view", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlView]);

  useEffect(() => {
    setSearchQuery(urlQ);
  }, [urlQ]);

  useEffect(() => {
    setProductFilter(urlProduct || "all");
  }, [urlProduct]);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products ?? []) map.set(product.id, product);
    return map;
  }, [products]);

  const filteredApplications = useMemo(() => {
    const list = applications ?? [];
    const q = normalizeForSearch(searchQuery);
    const product = productFilter;

    return list.filter((app) => {
      const matchesProduct =
        product === "all"
          ? true
          : product === "unassigned"
          ? !app.productId
          : app.productId === product;

      if (!matchesProduct) return false;

      if (!q) return true;
      const haystack = normalizeForSearch(
        [
          app.name,
          app.slug,
          app.description ?? "",
          app.repositoryUrl ?? "",
          app.gitProvider ?? "",
          app.deployProvider ?? "",
          app.dbProvider ?? "",
        ].join(" ")
      );
      return haystack.includes(q);
    });
  }, [applications, productFilter, searchQuery]);

  const groupedApplications = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; apps: Application[] }>();

    for (const app of filteredApplications) {
      const id = app.productId ?? "__unassigned__";
      const label = app.productId ? productsById.get(app.productId)?.name ?? "Unknown Product" : "Unassigned";
      const existing = groups.get(id);
      if (existing) {
        existing.apps.push(app);
      } else {
        groups.set(id, { id, label, apps: [app] });
      }
    }

    const sorted = [...groups.values()].sort((a, b) => {
      if (a.id === "__unassigned__") return 1;
      if (b.id === "__unassigned__") return -1;
      return a.label.localeCompare(b.label);
    });

    for (const group of sorted) {
      group.apps.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [filteredApplications, productsById]);

  const hasActiveFilters = searchQuery.trim().length > 0 || productFilter !== "all";

  const clearAll = () => {
    setUrlParam("q", null);
    setUrlParam("product", null);
  };

  const onViewModeChange = (next: ViewMode) => {
    setViewMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem("applications.view", next);
    setUrlParam("view", next);
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case "production":
        return "error";
      case "staging":
        return "warning";
      case "development":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Applications</h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Manage your applications, API keys, and secrets
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowK8sImportModal(true)}>
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Import from K8s</span>
          </Button>
          <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowImportModal(true)}>
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Import from Repo</span>
          </Button>
          <Link href="/applications/new">
            <Button size="sm" className="sm:size-default">
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Create from Template</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Advanced</span>
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search applications by name, slug, description, or provider..."
                value={searchQuery}
                onChange={(e) => setUrlParam("q", e.target.value ? e.target.value : null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.currentTarget.blur();
                    setUrlParam("q", null);
                  }
                }}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setUrlParam("q", null)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-md border border-gray-800 bg-gray-900 p-1" role="group" aria-label="View mode">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewModeChange("cards")}
                  className={cn(
                    "h-8 px-2",
                    viewMode === "cards" ? "bg-gray-800 text-gray-100" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewModeChange("list")}
                  className={cn(
                    "h-8 px-2",
                    viewMode === "list" ? "bg-gray-800 text-gray-100" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Filter className="h-4 w-4 mr-2" />
                    Product
                    <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px]">
                  <DropdownMenuLabel>Group / Filter</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={productFilter}
                    onValueChange={(value) => setUrlParam("product", value === "all" ? null : value)}
                  >
                    <DropdownMenuRadioItem value="all">All products</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="unassigned">Unassigned</DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    {(products ?? [])
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => (
                        <DropdownMenuRadioItem key={p.id} value={p.id}>
                          {p.name}
                        </DropdownMenuRadioItem>
                      ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-9 text-gray-400 hover:text-gray-200" onClick={clearAll}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {searchQuery.trim() && (
                <Badge variant="secondary" className="gap-1">
                  <span className="text-gray-300">q:</span>
                  <span className="max-w-[220px] truncate">{searchQuery}</span>
                  <button
                    type="button"
                    onClick={() => setUrlParam("q", null)}
                    className="ml-1 text-gray-400 hover:text-gray-200"
                    aria-label="Remove search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {productFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  <span className="text-gray-300">product:</span>
                  <span className="max-w-[220px] truncate">
                    {productFilter === "unassigned"
                      ? "Unassigned"
                      : productsById.get(productFilter)?.name ?? "Unknown"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUrlParam("product", null)}
                    className="ml-1 text-gray-400 hover:text-gray-200"
                    aria-label="Remove product filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <span className="text-xs text-gray-500">
                {filteredApplications.length} match{filteredApplications.length === 1 ? "" : "es"}
              </span>
            </div>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-800 rounded w-full"></div>
                <div className="h-4 bg-gray-800 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : applications && applications.length > 0 ? (
        filteredApplications.length > 0 ? (
          <div className="space-y-8">
            {groupedApplications.map((group) => (
              <div key={group.id} className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{group.label}</h2>
                    <p className="text-xs text-gray-500">{group.apps.length} app{group.apps.length === 1 ? "" : "s"}</p>
                  </div>
                </div>

                {viewMode === "cards" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.apps.map((app) => (
                      <Card
                        key={app.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Open ${app.name}`}
                        onClick={() => openApplication(app.slug)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openApplication(app.slug);
                          }
                        }}
                        className="p-6 hover:border-gray-700 transition-colors h-full flex flex-col cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-950/20 rounded-lg">
                              <Code className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{app.name}</h3>
                              <p className="text-sm text-gray-400">{app.slug}</p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              getEnvironmentColor(app.settings.environment) as
                                | "default"
                                | "warning"
                                | "error"
                                | "secondary"
                            }
                          >
                            {app.settings.environment}
                          </Badge>
                        </div>

                        {app.description && (
                          <p className="text-sm text-gray-400 mb-3 line-clamp-2">{app.description}</p>
                        )}

                        <ProviderBadges
                          gitProvider={app.gitProvider}
                          deployProvider={app.deployProvider}
                          dbProvider={app.dbProvider}
                          className="mb-4"
                        />

                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Key className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-400">
                              {app.apiKeys.length} API {app.apiKeys.length === 1 ? "Key" : "Keys"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Shield className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-400">
                              {app.secrets.length} {app.secrets.length === 1 ? "Secret" : "Secrets"}
                            </span>
                          </div>
                          {app.settings.domain && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-400 truncate">{app.settings.domain}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-4 border-t border-gray-800">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>Created {new Date(app.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/applications/${encodeURIComponent(app.slug)}/dashboard`}
                              className="flex-1 sm:flex-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 w-full sm:w-auto"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <LayoutDashboard className="h-3 w-3 mr-1" />
                                Dashboard
                              </Button>
                            </Link>
                            <Link
                              href={`/applications/${encodeURIComponent(app.slug)}`}
                              className="flex-1 sm:flex-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 w-full sm:w-auto"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Details
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {group.apps.map((app) => (
                      <Card
                        key={app.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Open ${app.name}`}
                        onClick={() => openApplication(app.slug)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openApplication(app.slug);
                          }
                        }}
                        className="p-4 hover:border-gray-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-blue-950/20 rounded-lg">
                              <Code className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-semibold truncate">{app.name}</h3>
                                <Badge
                                  variant={
                                    getEnvironmentColor(app.settings.environment) as
                                      | "default"
                                      | "warning"
                                      | "error"
                                      | "secondary"
                                  }
                                  className="shrink-0"
                                >
                                  {app.settings.environment}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-400 truncate">{app.slug}</p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <ProviderBadges gitProvider={app.gitProvider} deployProvider={app.deployProvider} dbProvider={app.dbProvider} />
                            <div className="flex items-center gap-2">
                              <Link href={`/applications/${encodeURIComponent(app.slug)}/dashboard`} onClick={(e) => e.stopPropagation()}>
                                <Button variant="outline" size="sm" className="h-8" onClick={(e) => e.stopPropagation()}>
                                  <LayoutDashboard className="h-3 w-3 mr-1" />
                                  Dashboard
                                </Button>
                              </Link>
                              <Link href={`/applications/${encodeURIComponent(app.slug)}`} onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8" onClick={(e) => e.stopPropagation()}>
                                  Details
                                  <ChevronRight className="h-3 w-3 ml-1" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Search className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No matches</h3>
            <p className="text-gray-400 mb-6">Try adjusting your search or filters.</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={clearAll}>
                <X className="h-4 w-4 mr-2" />
                Clear filters
              </Button>
            </div>
          </Card>
        )
      ) : (
        <Card className="p-12 text-center">
          <Code className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No applications yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first application from a template with pre-configured integrations
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/applications/new">
              <Button>
                <Sparkles className="h-4 w-4 mr-2" />
                Create from Template
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Advanced Setup
            </Button>
          </div>
        </Card>
      )}

      {showCreateModal && (
        <AppCreationWizard
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refetch();
            // TODO: optionally redirect to the new app
          }}
        />
      )}

      <ImportAppWizard
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          refetch();
        }}
      />

      <K8sImportWizard
        isOpen={showK8sImportModal}
        onClose={() => setShowK8sImportModal(false)}
        onSuccess={() => {
          setShowK8sImportModal(false);
          refetch();
        }}
      />
    </div>
  );
}
