"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OverviewTab } from "@/components/apps/detail/overview-tab";
import { DeploymentsTab } from "@/components/apps/detail/deployments-tab";
import { LogsTab } from "@/components/apps/detail/logs-tab";
import { MetricsTab } from "@/components/apps/detail/metrics-tab";
import { SettingsTab } from "@/components/apps/detail/settings-tab";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "deployments", label: "Deployments" },
  { id: "logs", label: "Logs" },
  { id: "metrics", label: "Metrics" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as TabId) || "overview";

  const setTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{slug}</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab appId={slug} />}
      {activeTab === "deployments" && <DeploymentsTab appId={slug} />}
      {activeTab === "logs" && <LogsTab appId={slug} />}
      {activeTab === "metrics" && <MetricsTab appId={slug} />}
      {activeTab === "settings" && <SettingsTab appId={slug} />}
    </div>
  );
}
