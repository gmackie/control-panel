import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { AppCard } from "@/components/apps/app-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, LayoutGrid, Server, Settings, Rocket, GitBranch, Bell, Box, Plug, LogOut, ArrowLeft } from "lucide-react";
import { allApps, mockNodes, mockPods } from "@/__mocks__/fixtures";

// Reusable sidebar for page stories
function MiniSidebar({ active }: { active: string }) {
  const sections = [
    { label: "Monitor", items: [
      { icon: LayoutGrid, label: "Dashboard" },
      { icon: LayoutGrid, label: "Applications" },
      { icon: Server, label: "Cluster" },
      { icon: Box, label: "Registry" },
    ]},
    { label: "Operations", items: [
      { icon: Rocket, label: "Deployments" },
      { icon: GitBranch, label: "CI/CD" },
      { icon: Bell, label: "Alerts" },
    ]},
    { label: "System", items: [
      { icon: Plug, label: "Integrations" },
      { icon: Settings, label: "Settings" },
    ]},
  ];
  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-border bg-card">
      <div className="px-6 py-5">
        <span className="font-display text-lg font-bold tracking-tight">GMAC.IO</span>
      </div>
      <nav className="flex-1 px-3 space-y-6">
        {sections.map((s) => (
          <div key={s.label}>
            <p className="px-3 mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">{s.label}</p>
            <div className="space-y-0.5">
              {s.items.map((item) => (
                <div key={item.label} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                  item.label === active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
                )}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">gmackie</span>
          <Button variant="ghost" size="icon" className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6">
      <h1 className="font-display text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-muted-foreground">healthy</span>
          <span className="font-mono text-xs text-muted-foreground">(3/3 nodes)</span>
        </div>
        <kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-dim">⌘K</kbd>
      </div>
    </header>
  );
}

const meta: Meta = {
  title: "Pages",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const ApplicationsPage: Story = {
  name: "Applications",
  render: () => (
    <div className="flex h-[700px] bg-background text-foreground overflow-hidden">
      <MiniSidebar active="Applications" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Applications" />
        <main className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold">Applications</h1>
              <p className="text-sm text-muted-foreground mt-1">4 apps across your infrastructure</p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search apps..." className="pl-9" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allApps.map((app) => (
              <AppCard key={app.id} app={app} onClick={() => {}} />
            ))}
          </div>
        </main>
      </div>
    </div>
  ),
};

export const InfrastructurePage: Story = {
  name: "Infrastructure",
  render: () => (
    <div className="flex h-[700px] bg-background text-foreground overflow-hidden">
      <MiniSidebar active="Cluster" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Infrastructure" />
        <main className="flex-1 overflow-auto p-6 space-y-8">
          <div>
            <h1 className="font-display text-2xl font-bold">Infrastructure</h1>
            <p className="text-sm text-muted-foreground mt-1">Cluster health, pods, and costs</p>
          </div>

          {/* Node Grid */}
          <section>
            <h2 className="font-display text-lg font-semibold mb-4">Nodes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {mockNodes.map((node) => (
                <Card key={`${node.clusterId}-${node.name}`} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">{node.name}</span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {node.clusterId === "production" ? "prod" : "staging"}
                      </span>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>IP</span><span className="font-mono">{node.internalIP}</span></div>
                    <div className="flex justify-between"><span>CPU</span><span className="font-mono tabular-nums">{Math.round((node.cpu.usageMillis! / node.cpu.allocatableMillis) * 100)}%</span></div>
                    <div className="flex justify-between"><span>Memory</span><span className="font-mono tabular-nums">{Math.round((node.memory.usageBytes! / node.memory.allocatableBytes) * 100)}%</span></div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Pod Table excerpt */}
          <section>
            <h2 className="font-display text-lg font-semibold mb-4">Pods</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Pod", "Namespace", "Cluster", "Status", "Ready", "Restarts"].map((h) => (
                      <th key={h} className="pb-2 font-mono text-[11px] uppercase tracking-wider text-dim">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockPods.slice(0, 4).map((pod) => (
                    <tr key={pod.name} className="border-b border-border/50 hover:bg-accent/50">
                      <td className="py-2 font-mono text-[13px] font-medium">{pod.name}</td>
                      <td className="py-2 font-mono text-[13px] text-muted-foreground">{pod.namespace}</td>
                      <td className="py-2 font-mono text-[13px] text-muted-foreground">{pod.clusterId === "production" ? "Prod" : "Staging"}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("h-2 w-2 rounded-full", pod.status === "Running" ? "bg-green-500" : pod.status === "Failed" ? "bg-red-500" : "bg-yellow-500")} />
                          <span className="font-mono text-[13px]">{pod.status}</span>
                        </div>
                      </td>
                      <td className="py-2 font-mono text-[13px] tabular-nums text-muted-foreground">{pod.ready}</td>
                      <td className="py-2 font-mono text-[13px] tabular-nums text-muted-foreground">{pod.restarts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  ),
};

export const AppDetailPage: Story = {
  name: "App Detail",
  render: () => (
    <div className="flex h-[700px] bg-background text-foreground overflow-hidden">
      <MiniSidebar active="Applications" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="control-panel" />
        <main className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="font-display text-2xl font-bold">control-panel</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border mb-6">
            {["Overview", "Deployments", "Logs", "Metrics", "Registry", "Alerts", "Settings"].map((tab, i) => (
              <button
                key={tab}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px",
                  i === 0 ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview content */}
          <div className="space-y-6 max-w-3xl">
            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold mb-3">Application Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> control-panel</div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-mono text-[13px]">healthy</span></div>
                <div><span className="text-muted-foreground">Git:</span> <span className="font-mono text-[13px]">gitea</span></div>
                <div><span className="text-muted-foreground">Deploy:</span> <span className="font-mono text-[13px]">kubernetes</span></div>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold mb-3">K8s Status</h3>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Production</span>
                <span className="font-mono text-[11px] text-muted-foreground">default/control-panel</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Replicas:</span> <span className="font-mono text-[13px] tabular-nums text-green-500">2/2</span></div>
                <div><span className="text-muted-foreground">Updated:</span> <span className="font-mono text-[13px] tabular-nums">2</span></div>
                <div><span className="text-muted-foreground">Strategy:</span> <span className="font-mono text-[13px]">RollingUpdate</span></div>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-display text-sm font-semibold mb-3">Recent Deployments</h3>
              {[
                { env: "production", sha: "f57fb6f", ok: true, time: "12 min ago" },
                { env: "staging", sha: "a1b2c3d", ok: true, time: "2 hrs ago" },
              ].map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${d.ok ? "bg-green-500" : "bg-red-500"}`} />
                    <span>{d.env}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{d.sha}</span>
                  </div>
                  <span className="font-mono text-[13px] text-muted-foreground">{d.time}</span>
                </div>
              ))}
            </Card>
          </div>
        </main>
      </div>
    </div>
  ),
};

export const SettingsPage: Story = {
  name: "Settings",
  render: () => (
    <div className="flex h-[700px] bg-background text-foreground overflow-hidden">
      <MiniSidebar active="Settings" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Settings" />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6 max-w-2xl">
            <div>
              <h1 className="font-display text-2xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">Account and configuration</p>
            </div>
            <Card className="p-6">
              <h2 className="font-display text-lg font-semibold mb-4">Account</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>gmackie</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>g@gmac.io</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span>GitHub</span></div>
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="font-display text-lg font-semibold mb-4">API Keys</h2>
              <p className="text-sm text-muted-foreground">API key management will be wired here via tRPC.</p>
            </Card>
          </div>
        </main>
      </div>
    </div>
  ),
};

export const PlaceholderPage: Story = {
  name: "Placeholder (Coming Soon)",
  render: () => (
    <div className="flex h-[700px] bg-background text-foreground overflow-hidden">
      <MiniSidebar active="Deployments" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Deployments" />
        <main className="flex-1 overflow-auto p-6">
          <h1 className="font-display text-2xl font-bold">Deployments</h1>
          <p className="text-sm text-muted-foreground mt-1">Coming soon</p>
        </main>
      </div>
    </div>
  ),
};
