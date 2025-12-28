"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Filter, Grid, List } from "lucide-react";
import ServiceCard from "@/components/services/ServiceCard";
import ServiceList from "@/components/services/ServiceList";
import CreateServiceModal from "@/components/services/CreateServiceModal";
import ServiceFilters from "@/components/services/ServiceFilters";
import { ServiceTemplate } from "@/types";

export default function ServicesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedFramework, setSelectedFramework] = useState<string>("all");

  const { data: services, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const response = await fetch("/api/services");
      return response.json();
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["service-templates"],
    queryFn: async () => {
      const response = await fetch("/api/services/templates");
      return response.json();
    },
  });

  const filteredServices =
    services?.filter((service: any) => {
      const matchesSearch =
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || service.category === selectedCategory;
      const matchesFramework =
        selectedFramework === "all" || service.framework === selectedFramework;

      return matchesSearch && matchesCategory && matchesFramework;
    }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">
            Manage your applications and services
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Create Service
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <ServiceFilters
          selectedCategory={selectedCategory}
          selectedFramework={selectedFramework}
          onCategoryChange={setSelectedCategory}
          onFrameworkChange={setSelectedFramework}
        />

        <div className="flex items-center gap-2 border border-input rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Services Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No services found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ||
            selectedCategory !== "all" ||
            selectedFramework !== "all"
              ? "Try adjusting your search or filters"
              : "Get started by creating your first service"}
          </p>
          {!searchTerm &&
            selectedCategory === "all" &&
            selectedFramework === "all" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Create Your First Service
              </button>
            )}
        </div>
      ) : (
        <div>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service: any) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <ServiceList services={filteredServices} />
          )}
        </div>
      )}

      {/* Create Service Modal */}
      {showCreateModal && (
        <CreateServiceModal
          templates={templates || []}
          onClose={() => setShowCreateModal(false)}
          onServiceCreated={(service) => {
            setShowCreateModal(false);
            // Refresh the services list
            // This would typically be handled by React Query invalidation
          }}
        />
      )}
    </div>
  );
}
