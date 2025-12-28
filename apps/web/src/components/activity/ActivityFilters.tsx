"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  Shield,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Server,
  Database,
  Settings,
  X,
  Filter,
} from "lucide-react";
import { ActivitySource, ActivityCategory, ActivitySeverity } from "@/lib/activity/types";

interface ActivityFiltersProps {
  selectedSources: ActivitySource[];
  selectedCategories: ActivityCategory[];
  selectedSeverities: ActivitySeverity[];
  onSourcesChange: (sources: ActivitySource[]) => void;
  onCategoriesChange: (categories: ActivityCategory[]) => void;
  onSeveritiesChange: (severities: ActivitySeverity[]) => void;
  onClear: () => void;
}

const SOURCES: { id: ActivitySource; label: string; icon: React.ReactNode }[] = [
  { id: "gitea", label: "Gitea", icon: <GitBranch className="h-3 w-3" /> },
  { id: "clerk", label: "Clerk", icon: <Shield className="h-3 w-3" /> },
  { id: "stripe", label: "Stripe", icon: <CreditCard className="h-3 w-3" /> },
  { id: "sentry", label: "Sentry", icon: <AlertTriangle className="h-3 w-3" /> },
  { id: "posthog", label: "PostHog", icon: <BarChart3 className="h-3 w-3" /> },
  { id: "kubernetes", label: "K8s", icon: <Server className="h-3 w-3" /> },
  { id: "neon", label: "Neon", icon: <Database className="h-3 w-3" /> },
  { id: "system", label: "System", icon: <Settings className="h-3 w-3" /> },
];

const CATEGORIES: { id: ActivityCategory; label: string }[] = [
  { id: "deployment", label: "Deployments" },
  { id: "repository", label: "Repository" },
  { id: "auth", label: "Auth" },
  { id: "payment", label: "Payments" },
  { id: "error", label: "Errors" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "integration", label: "Integrations" },
  { id: "security", label: "Security" },
];

const SEVERITIES: { id: ActivitySeverity; label: string; color: string }[] = [
  { id: "critical", label: "Critical", color: "bg-red-600" },
  { id: "error", label: "Error", color: "bg-red-500" },
  { id: "warning", label: "Warning", color: "bg-yellow-500" },
  { id: "info", label: "Info", color: "bg-blue-500" },
];

export function ActivityFilters({
  selectedSources,
  selectedCategories,
  selectedSeverities,
  onSourcesChange,
  onCategoriesChange,
  onSeveritiesChange,
  onClear,
}: ActivityFiltersProps) {
  const hasFilters = 
    selectedSources.length > 0 || 
    selectedCategories.length > 0 || 
    selectedSeverities.length > 0;

  const toggleSource = (source: ActivitySource) => {
    if (selectedSources.includes(source)) {
      onSourcesChange(selectedSources.filter(s => s !== source));
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };

  const toggleCategory = (category: ActivityCategory) => {
    if (selectedCategories.includes(category)) {
      onCategoriesChange(selectedCategories.filter(c => c !== category));
    } else {
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  const toggleSeverity = (severity: ActivitySeverity) => {
    if (selectedSeverities.includes(severity)) {
      onSeveritiesChange(selectedSeverities.filter(s => s !== severity));
    } else {
      onSeveritiesChange([...selectedSeverities, severity]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Severity */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Severity</p>
        <div className="flex flex-wrap gap-1">
          {SEVERITIES.map(severity => (
            <Button
              key={severity.id}
              variant={selectedSeverities.includes(severity.id) ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => toggleSeverity(severity.id)}
            >
              <span className={`w-2 h-2 rounded-full mr-1 ${severity.color}`} />
              {severity.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Source</p>
        <div className="flex flex-wrap gap-1">
          {SOURCES.map(source => (
            <Button
              key={source.id}
              variant={selectedSources.includes(source.id) ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => toggleSource(source.id)}
            >
              {source.icon}
              <span className="ml-1">{source.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Category</p>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(category => (
            <Button
              key={category.id}
              variant={selectedCategories.includes(category.id) ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => toggleCategory(category.id)}
            >
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Active filters summary */}
      {hasFilters && (
        <div className="pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-400 mb-2">Active filters:</p>
          <div className="flex flex-wrap gap-1">
            {selectedSeverities.map(s => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
                <button className="ml-1" onClick={() => toggleSeverity(s)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedSources.map(s => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
                <button className="ml-1" onClick={() => toggleSource(s)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedCategories.map(c => (
              <Badge key={c} variant="outline" className="text-xs">
                {c}
                <button className="ml-1" onClick={() => toggleCategory(c)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
