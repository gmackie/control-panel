"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tag,
  GitBranch,
  FileText,
  Loader2,
  Sparkles,
  CheckSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import type { Release, ReleaseStatus } from "./ReleaseCard";

interface ReleaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release?: Release | null;
  applicationId: string;
  onSave: (data: ReleaseFormData) => void;
  onDelete?: (releaseId: string) => void;
  isLoading?: boolean;
}

export interface ReleaseFormData {
  version: string;
  name: string;
  description: string;
  changelog: string;
  status: ReleaseStatus;
  targetBranch: string;
  isPrerelease: boolean;
}

const statusOptions: { value: ReleaseStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-gray-500" },
  { value: "ready", label: "Ready", color: "bg-blue-500" },
  { value: "published", label: "Published", color: "bg-green-500" },
  { value: "deployed", label: "Deployed", color: "bg-purple-500" },
];

export function ReleaseModal({
  open,
  onOpenChange,
  release,
  applicationId,
  onSave,
  onDelete,
  isLoading = false,
}: ReleaseModalProps) {
  const isEditing = !!release;

  const [formData, setFormData] = useState<ReleaseFormData>({
    version: "",
    name: "",
    description: "",
    changelog: "",
    status: "draft",
    targetBranch: "main",
    isPrerelease: false,
  });

  const [versionType, setVersionType] = useState<"major" | "minor" | "patch">("patch");

  const suggestVersion = trpc.releases.suggestNextVersion.useQuery(
    { applicationId, type: versionType },
    { enabled: open && !isEditing }
  );

  const generateChangelog = trpc.releases.generateChangelog.useQuery(
    release?.id || "",
    { enabled: open && isEditing && !!release?.id }
  );

  useEffect(() => {
    if (open) {
      if (release) {
        setFormData({
          version: release.version,
          name: release.name || "",
          description: release.description || "",
          changelog: release.changelog || "",
          status: release.status,
          targetBranch: release.targetBranch || "main",
          isPrerelease: release.isPrerelease,
        });
      } else {
        setFormData({
          version: suggestVersion.data?.version || "",
          name: "",
          description: "",
          changelog: "",
          status: "draft",
          targetBranch: "main",
          isPrerelease: false,
        });
      }
    }
  }, [open, release, suggestVersion.data?.version]);

  const suggestedVersion = suggestVersion.data?.version;
  useEffect(() => {
    if (!isEditing && suggestedVersion) {
      setFormData((prev) => ({ ...prev, version: suggestedVersion }));
    }
  }, [suggestedVersion, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.version.trim()) return;
    onSave(formData);
  };

  const handleAutoGenerateChangelog = () => {
    if (generateChangelog.data?.changelog) {
      setFormData((prev) => ({
        ...prev,
        changelog: generateChangelog.data!.changelog,
      }));
    }
  };

  const canDelete = release && release.status !== "published";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-950 border-gray-800">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-400" />
            {isEditing ? `Edit Release v${release.version}` : "Create Release"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version" className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-400" />
                Version
              </Label>
              <div className="space-y-2">
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={formData.version}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, version: e.target.value }))
                  }
                  className="bg-gray-900 border-gray-800 focus:border-gray-700 font-mono"
                  required
                  pattern="^\d+\.\d+\.\d+(-[\w.]+)?$"
                  title="Use semantic versioning (e.g., 1.0.0 or 1.0.0-beta.1)"
                />
                {!isEditing && (
                  <div className="flex gap-1">
                    {(["patch", "minor", "major"] as const).map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setVersionType(type)}
                        className={cn(
                          "text-xs capitalize border-gray-800 bg-gray-900",
                          versionType === type && "border-blue-500 bg-blue-500/10"
                        )}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetBranch" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-gray-400" />
                Target Branch
              </Label>
              <Input
                id="targetBranch"
                placeholder="main"
                value={formData.targetBranch}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetBranch: e.target.value }))
                }
                className="bg-gray-900 border-gray-800 focus:border-gray-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Release Name (optional)</Label>
            <Input
              id="name"
              placeholder='e.g., "Phoenix" or "Summer Update"'
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="bg-gray-900 border-gray-800 focus:border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of this release..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="bg-gray-900 border-gray-800 focus:border-gray-700 min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="changelog" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                Changelog
              </Label>
              {isEditing && release?.linkedTasks && release.linkedTasks.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGenerateChangelog}
                  disabled={generateChangelog.isLoading}
                  className="text-xs border-gray-800 bg-gray-900 hover:bg-gray-800"
                >
                  {generateChangelog.isLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Auto-generate from tasks
                </Button>
              )}
            </div>
            <Textarea
              id="changelog"
              placeholder="## What's New&#10;&#10;- Feature 1&#10;- Bug fix 2"
              value={formData.changelog}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, changelog: e.target.value }))
              }
              className="bg-gray-900 border-gray-800 focus:border-gray-700 min-h-[150px] font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, status: option.value }))
                    }
                    disabled={
                      release?.status === "published" &&
                      option.value !== "deployed" &&
                      option.value !== "published"
                    }
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md border transition-colors",
                      formData.status === option.value
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700",
                      release?.status === "published" &&
                        option.value !== "deployed" &&
                        option.value !== "published" &&
                        "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block w-2 h-2 rounded-full mr-2",
                        option.color
                      )}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">Pre-release</span>
                </div>
                <Switch
                  checked={formData.isPrerelease}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isPrerelease: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {isEditing && release?.linkedTasks && release.linkedTasks.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-gray-400" />
                Linked Tasks ({release.linkedTasks.length})
              </Label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-900 rounded-lg border border-gray-800 max-h-32 overflow-y-auto">
                {release.linkedTasks.map((task) => (
                  <Badge
                    key={task.id}
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      task.status === "done"
                        ? "bg-green-500/10 text-green-400"
                        : task.status === "in_progress"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-gray-800 text-gray-400"
                    )}
                  >
                    {task.title}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <div>
              {canDelete && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(release.id)}
                  disabled={isLoading}
                  className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                >
                  Delete Release
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="border-gray-800 bg-gray-900 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!formData.version.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Release"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
