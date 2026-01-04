"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  GripVertical,
  AlertCircle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

export interface Task {
  id: string;
  applicationId: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
  priority: "urgent" | "high" | "medium" | "low" | null;
  assignee: string | null;
  labels: string[];
  dueDate: Date | string | null;
  releaseId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

const priorityConfig: Record<string, { color: string; label: string }> = {
  urgent: { color: "bg-red-500/10 text-red-500 border-red-500/20", label: "Urgent" },
  high: { color: "bg-orange-500/10 text-orange-500 border-orange-500/20", label: "High" },
  medium: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", label: "Medium" },
  low: { color: "bg-gray-500/10 text-gray-400 border-gray-500/20", label: "Low" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getDueDateStatus(dueDate: Date | string | null): {
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
} {
  if (!dueDate) return { isOverdue: false, isDueToday: false, isDueSoon: false };
  
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  return {
    isOverdue: isPast(date) && !isToday(date),
    isDueToday: isToday(date),
    isDueSoon: date <= threeDaysFromNow && !isPast(date) && !isToday(date),
  };
}

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;
  const dueDateStatus = getDueDateStatus(task.dueDate);
  const dueDate = task.dueDate
    ? typeof task.dueDate === "string"
      ? new Date(task.dueDate)
      : task.dueDate
    : null;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 bg-gray-900 border-gray-800 hover:border-gray-700 cursor-pointer transition-all group",
        dragging && "opacity-50 shadow-lg ring-2 ring-blue-500/50",
        "hover:bg-gray-800/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <button
          className="mt-0.5 p-1 -ml-1 text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <h4 className="text-sm font-medium text-gray-100 line-clamp-2">
            {task.title}
          </h4>

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.labels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="px-1.5 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded"
                >
                  {label}
                </span>
              ))}
              {task.labels.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-gray-500">
                  +{task.labels.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Bottom Row: Priority, Due Date, Assignee */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Priority Badge */}
              {task.priority && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-1.5 py-0",
                    priorityConfig[task.priority]?.color
                  )}
                >
                  {task.priority === "urgent" && (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  {priorityConfig[task.priority]?.label}
                </Badge>
              )}

              {/* Due Date */}
              {dueDate && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    dueDateStatus.isOverdue && "text-red-500",
                    dueDateStatus.isDueToday && "text-yellow-500",
                    dueDateStatus.isDueSoon && "text-orange-400",
                    !dueDateStatus.isOverdue &&
                      !dueDateStatus.isDueToday &&
                      !dueDateStatus.isDueSoon &&
                      "text-gray-500"
                  )}
                >
                  {dueDateStatus.isOverdue ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <Calendar className="h-3 w-3" />
                  )}
                  <span>
                    {dueDateStatus.isOverdue
                      ? "Overdue"
                      : dueDateStatus.isDueToday
                      ? "Today"
                      : formatDistanceToNow(dueDate, { addSuffix: false })}
                  </span>
                </div>
              )}
            </div>

            {/* Assignee Avatar */}
            {task.assignee && (
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300"
                title={task.assignee}
              >
                {getInitials(task.assignee)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Skeleton for loading state
export function TaskCardSkeleton() {
  return (
    <Card className="p-3 bg-gray-900 border-gray-800">
      <div className="space-y-2">
        <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-800 rounded animate-pulse w-1/2" />
        <div className="flex items-center justify-between">
          <div className="h-5 bg-gray-800 rounded animate-pulse w-16" />
          <div className="h-6 w-6 bg-gray-800 rounded-full animate-pulse" />
        </div>
      </div>
    </Card>
  );
}
