"use client";

import { usePathname } from "next/navigation";
import { ClusterStatusIndicator } from "./cluster-status-indicator";

const pageTitles: Record<string, string> = {
  "/": "Applications",
  "/apps": "Applications",
  "/infrastructure": "Infrastructure",
  "/releases": "Releases",
  "/monitoring": "Monitoring",
  "/integrations": "Integrations",
  "/settings": "Settings",
};

export function TopBar() {
  const pathname = usePathname();

  // Derive page title from pathname
  let title = pageTitles[pathname];
  if (!title && pathname.startsWith("/apps/")) {
    title = pathname.split("/")[2] ?? "App Detail";
  }
  title = title ?? "Dashboard";

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6">
      <h1 className="font-display text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <ClusterStatusIndicator />
        <kbd className="hidden md:inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-dim">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}
