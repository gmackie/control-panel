"use client";

import { ChevronDown } from "lucide-react";

interface ServiceFiltersProps {
  selectedCategory: string;
  selectedFramework: string;
  onCategoryChange: (category: string) => void;
  onFrameworkChange: (framework: string) => void;
}

const categories = [
  { value: "all", label: "All Categories" },
  { value: "web", label: "Web Applications" },
  { value: "api", label: "API Services" },
  { value: "worker", label: "Background Workers" },
  { value: "database", label: "Databases" },
  { value: "monitoring", label: "Monitoring" },
];

const frameworks = [
  { value: "all", label: "All Frameworks" },
  { value: "nextjs", label: "Next.js" },
  { value: "react", label: "React" },
  { value: "vue", label: "Vue.js" },
  { value: "angular", label: "Angular" },
  { value: "go", label: "Go" },
  { value: "python", label: "Python" },
  { value: "nodejs", label: "Node.js" },
  { value: "rust", label: "Rust" },
  { value: "custom", label: "Custom" },
];

export default function ServiceFilters({
  selectedCategory,
  selectedFramework,
  onCategoryChange,
  onFrameworkChange,
}: ServiceFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Category Filter */}
      <div className="relative">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="appearance-none bg-background border border-input rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>

      {/* Framework Filter */}
      <div className="relative">
        <select
          value={selectedFramework}
          onChange={(e) => onFrameworkChange(e.target.value)}
          className="appearance-none bg-background border border-input rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {frameworks.map((framework) => (
            <option key={framework.value} value={framework.value}>
              {framework.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}
