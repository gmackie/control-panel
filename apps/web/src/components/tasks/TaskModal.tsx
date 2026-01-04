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
import { X, Plus, Calendar, User, Tag, Flag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "./TaskCard";

type TaskStatus = Task["status"];
type TaskPriority = NonNullable<Task["priority"]>;

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  applicationId: string;
  defaultStatus?: TaskStatus;
  onSave: (data: TaskFormData) => void;
  onDelete?: (taskId: string) => void;
  isLoading?: boolean;
}

export interface TaskFormData {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  assignee: string;
  labels: string[];
  dueDate: string;
}

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: "backlog", label: "Backlog", color: "bg-gray-500" },
  { value: "todo", label: "To Do", color: "bg-blue-500" },
  { value: "in_progress", label: "In Progress", color: "bg-yellow-500" },
  { value: "in_review", label: "In Review", color: "bg-purple-500" },
  { value: "done", label: "Done", color: "bg-green-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "text-red-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low", label: "Low", color: "text-gray-400" },
];

export function TaskModal({
  open,
  onOpenChange,
  task,
  applicationId,
  defaultStatus = "backlog",
  onSave,
  onDelete,
  isLoading = false,
}: TaskModalProps) {
  const isEditing = !!task;

  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    status: defaultStatus,
    priority: null,
    assignee: "",
    labels: [],
    dueDate: "",
  });

  const [newLabel, setNewLabel] = useState("");
  const [showLabelInput, setShowLabelInput] = useState(false);

  // Reset form when modal opens/task changes
  useEffect(() => {
    if (open) {
      if (task) {
        setFormData({
          title: task.title,
          description: task.description || "",
          status: task.status,
          priority: task.priority,
          assignee: task.assignee || "",
          labels: task.labels || [],
          dueDate: task.dueDate
            ? new Date(task.dueDate).toISOString().split("T")[0]
            : "",
        });
      } else {
        setFormData({
          title: "",
          description: "",
          status: defaultStatus,
          priority: null,
          assignee: "",
          labels: [],
          dueDate: "",
        });
      }
      setNewLabel("");
      setShowLabelInput(false);
    }
  }, [open, task, defaultStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSave(formData);
  };

  const addLabel = () => {
    if (newLabel.trim() && !formData.labels.includes(newLabel.trim())) {
      setFormData((prev) => ({
        ...prev,
        labels: [...prev.labels, newLabel.trim()],
      }));
      setNewLabel("");
      setShowLabelInput(false);
    }
  };

  const removeLabel = (labelToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.filter((l) => l !== labelToRemove),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-950 border-gray-800">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? "Edit Task" : "Create Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter task title..."
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="bg-gray-900 border-gray-800 focus:border-gray-700"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description (supports markdown)..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="bg-gray-900 border-gray-800 focus:border-gray-700 min-h-[120px]"
            />
          </div>

          {/* Status and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-gray-400" />
                Status
              </Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, status: option.value }))
                    }
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md border transition-colors",
                      formData.status === option.value
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700"
                    )}
                  >
                    <span
                      className={cn("inline-block w-2 h-2 rounded-full mr-2", option.color)}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-gray-400" />
                Priority
              </Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, priority: null }))
                  }
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md border transition-colors",
                    formData.priority === null
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700"
                  )}
                >
                  None
                </button>
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, priority: option.value }))
                    }
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md border transition-colors",
                      formData.priority === option.value
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700"
                    )}
                  >
                    <span className={option.color}>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assignee and Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assignee */}
            <div className="space-y-2">
              <Label htmlFor="assignee" className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                Assignee
              </Label>
              <Input
                id="assignee"
                placeholder="Enter assignee name..."
                value={formData.assignee}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, assignee: e.target.value }))
                }
                className="bg-gray-900 border-gray-800 focus:border-gray-700"
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                }
                className="bg-gray-900 border-gray-800 focus:border-gray-700"
              />
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-400" />
              Labels
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              {formData.labels.map((label) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => removeLabel(label)}
                    className="ml-1 hover:text-blue-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {showLabelInput ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLabel();
                      } else if (e.key === "Escape") {
                        setShowLabelInput(false);
                        setNewLabel("");
                      }
                    }}
                    placeholder="Label name..."
                    className="h-7 w-32 bg-gray-900 border-gray-800 text-sm"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addLabel}
                    className="h-7 px-2"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowLabelInput(false);
                      setNewLabel("");
                    }}
                    className="h-7 px-2"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLabelInput(true)}
                  className="h-7 border-gray-800 bg-gray-900 hover:bg-gray-800"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Label
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <DialogFooter className="flex items-center justify-between">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(task.id)}
                  disabled={isLoading}
                  className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                >
                  Delete Task
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
                disabled={!formData.title.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
