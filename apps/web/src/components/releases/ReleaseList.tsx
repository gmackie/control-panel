"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tag,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  X,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

import { ReleaseCard, ReleaseCardSkeleton, type Release, type ReleaseStatus } from "./ReleaseCard";
import { ReleaseModal, type ReleaseFormData } from "./ReleaseModal";

interface ReleaseListProps {
  applicationId: string;
}

const statusOptions: { value: ReleaseStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-gray-500" },
  { value: "ready", label: "Ready", color: "bg-blue-500" },
  { value: "published", label: "Published", color: "bg-green-500" },
  { value: "deployed", label: "Deployed", color: "bg-purple-500" },
];

export function ReleaseList({ applicationId }: ReleaseListProps) {
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);

  const {
    data: releasesData,
    isLoading,
    refetch,
  } = trpc.releases.list.useQuery(
    { applicationId },
    { refetchInterval: 30000 }
  );

  const createRelease = trpc.releases.create.useMutation({
    onSuccess: () => {
      utils.releases.list.invalidate({ applicationId });
      setModalOpen(false);
      setEditingRelease(null);
    },
  });

  const updateRelease = trpc.releases.update.useMutation({
    onSuccess: () => {
      utils.releases.list.invalidate({ applicationId });
      setModalOpen(false);
      setEditingRelease(null);
    },
  });

  const deleteRelease = trpc.releases.delete.useMutation({
    onSuccess: () => {
      utils.releases.list.invalidate({ applicationId });
      setModalOpen(false);
      setEditingRelease(null);
    },
  });

  const releases = releasesData?.items as Release[] | undefined;

  const filteredReleases = useMemo(() => {
    if (!releases) return [];

    return releases.filter((release) => {
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          release.version.toLowerCase().includes(searchLower) ||
          release.name?.toLowerCase().includes(searchLower) ||
          release.description?.toLowerCase().includes(searchLower) ||
          release.tagName?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (statusFilter.length > 0) {
        if (!statusFilter.includes(release.status)) return false;
      }

      return true;
    });
  }, [releases, search, statusFilter]);

  const toggleStatus = (status: ReleaseStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter([]);
  };

  const handleReleaseClick = useCallback((release: Release) => {
    setEditingRelease(release);
    setModalOpen(true);
  }, []);

  const handleNewRelease = useCallback(() => {
    setEditingRelease(null);
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(
    (formData: ReleaseFormData) => {
      if (editingRelease) {
        updateRelease.mutate({
          id: editingRelease.id,
          data: {
            version: formData.version,
            name: formData.name || null,
            description: formData.description || null,
            changelog: formData.changelog || null,
            status: formData.status,
            targetBranch: formData.targetBranch,
            isPrerelease: formData.isPrerelease,
          },
        });
      } else {
        createRelease.mutate({
          applicationId,
          version: formData.version,
          name: formData.name || undefined,
          description: formData.description || undefined,
          changelog: formData.changelog || undefined,
          targetBranch: formData.targetBranch,
          isPrerelease: formData.isPrerelease,
        });
      }
    },
    [editingRelease, applicationId, createRelease, updateRelease]
  );

  const handleDelete = useCallback(
    (releaseId: string) => {
      if (confirm("Are you sure you want to delete this release?")) {
        deleteRelease.mutate(releaseId);
      }
    },
    [deleteRelease]
  );

  const activeFilterCount = statusFilter.length + (search ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold">Releases</h2>
          {releases && (
            <Badge variant="secondary" className="bg-gray-800 text-gray-400">
              {releases.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-gray-800 bg-gray-900 hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleNewRelease}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Release
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search releases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-gray-900 border-gray-800 focus:border-gray-700"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className={cn(
              "border-gray-800 bg-gray-900 hover:bg-gray-800",
              statusFilter.length > 0 && "border-blue-500/50"
            )}
          >
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            Status
            {statusFilter.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-blue-500/20 text-blue-400"
              >
                {statusFilter.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
          </Button>

          {showStatusDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-gray-900 border border-gray-800 rounded-lg shadow-lg py-1">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleStatus(option.value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors",
                    statusFilter.includes(option.value) && "bg-gray-800"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", option.color)} />
                  <span className="flex-1">{option.label}</span>
                  {statusFilter.includes(option.value) && (
                    <span className="text-blue-400">&#10003;</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-gray-400 hover:text-gray-200"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {showStatusDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowStatusDropdown(false)}
          />
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <>
            <ReleaseCardSkeleton />
            <ReleaseCardSkeleton />
            <ReleaseCardSkeleton />
          </>
        ) : filteredReleases.length > 0 ? (
          filteredReleases.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              onClick={() => handleReleaseClick(release)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Tag className="h-12 w-12 text-gray-700 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-1">
              {releases?.length === 0 ? "No releases yet" : "No releases found"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {releases?.length === 0
                ? "Create your first release to start tracking versions."
                : "Try adjusting your search or filters."}
            </p>
            {releases?.length === 0 && (
              <Button
                onClick={handleNewRelease}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Release
              </Button>
            )}
          </div>
        )}
      </div>

      <ReleaseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        release={editingRelease}
        applicationId={applicationId}
        onSave={handleSave}
        onDelete={handleDelete}
        isLoading={
          createRelease.isPending ||
          updateRelease.isPending ||
          deleteRelease.isPending
        }
      />
    </div>
  );
}
