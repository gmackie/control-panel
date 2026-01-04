"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  User,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TaskPriority = "urgent" | "high" | "medium" | "low";

export interface TaskFiltersState {
  search: string;
  priority: TaskPriority[];
  assignee: string[];
}

interface TaskFiltersProps {
  filters: TaskFiltersState;
  onFiltersChange: (filters: TaskFiltersState) => void;
  assignees?: string[];
}

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "low", label: "Low", color: "bg-gray-500" },
];

export function TaskFilters({
  filters,
  onFiltersChange,
  assignees = [],
}: TaskFiltersProps) {
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  const activeFilterCount =
    filters.priority.length + filters.assignee.length + (filters.search ? 1 : 0);

  const togglePriority = (priority: TaskPriority) => {
    const newPriorities = filters.priority.includes(priority)
      ? filters.priority.filter((p) => p !== priority)
      : [...filters.priority, priority];
    onFiltersChange({ ...filters, priority: newPriorities });
  };

  const toggleAssignee = (assignee: string) => {
    const newAssignees = filters.assignee.includes(assignee)
      ? filters.assignee.filter((a) => a !== assignee)
      : [...filters.assignee, assignee];
    onFiltersChange({ ...filters, assignee: newAssignees });
  };

  const clearFilters = () => {
    onFiltersChange({ search: "", priority: [], assignee: [] });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-9 bg-gray-900 border-gray-800 focus:border-gray-700"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Priority Filter */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowPriorityDropdown(!showPriorityDropdown);
            setShowAssigneeDropdown(false);
          }}
          className={cn(
            "border-gray-800 bg-gray-900 hover:bg-gray-800",
            filters.priority.length > 0 && "border-blue-500/50"
          )}
        >
          <Flag className="h-4 w-4 mr-2 text-gray-400" />
          Priority
          {filters.priority.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-blue-500/20 text-blue-400"
            >
              {filters.priority.length}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
        </Button>

        {showPriorityDropdown && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-gray-900 border border-gray-800 rounded-lg shadow-lg py-1">
            {priorityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => togglePriority(option.value)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors",
                  filters.priority.includes(option.value) && "bg-gray-800"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", option.color)} />
                <span className="flex-1">{option.label}</span>
                {filters.priority.includes(option.value) && (
                  <span className="text-blue-400">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assignee Filter */}
      {assignees.length > 0 && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAssigneeDropdown(!showAssigneeDropdown);
              setShowPriorityDropdown(false);
            }}
            className={cn(
              "border-gray-800 bg-gray-900 hover:bg-gray-800",
              filters.assignee.length > 0 && "border-blue-500/50"
            )}
          >
            <User className="h-4 w-4 mr-2 text-gray-400" />
            Assignee
            {filters.assignee.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-blue-500/20 text-blue-400"
              >
                {filters.assignee.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
          </Button>

          {showAssigneeDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] max-h-[240px] overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg shadow-lg py-1">
              {assignees.map((assignee) => (
                <button
                  key={assignee}
                  onClick={() => toggleAssignee(assignee)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors",
                    filters.assignee.includes(assignee) && "bg-gray-800"
                  )}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium">
                    {assignee
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <span className="flex-1 truncate">{assignee}</span>
                  {filters.assignee.includes(assignee) && (
                    <span className="text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Filters & Clear */}
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

      {/* Click outside handler */}
      {(showPriorityDropdown || showAssigneeDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowPriorityDropdown(false);
            setShowAssigneeDropdown(false);
          }}
        />
      )}
    </div>
  );
}
