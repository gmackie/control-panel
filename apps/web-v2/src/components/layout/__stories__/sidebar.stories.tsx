import type { Meta, StoryObj } from "@storybook/react-webpack5";
import {
  LayoutGrid,
  Server,
  Settings,
  Rocket,
  GitBranch,
  Bell,
  Box,
  Plug,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const sections = [
  {
    label: "Monitor",
    items: [
      { icon: LayoutGrid, label: "Dashboard", active: false },
      { icon: LayoutGrid, label: "Applications", active: true },
      { icon: Server, label: "Cluster", active: false },
      { icon: Box, label: "Registry", active: false },
    ],
  },
  {
    label: "Operations",
    items: [
      { icon: Rocket, label: "Deployments", active: false },
      { icon: GitBranch, label: "CI/CD", active: false },
      { icon: Bell, label: "Alerts", active: false },
    ],
  },
  {
    label: "System",
    items: [
      { icon: Plug, label: "Integrations", active: false },
      { icon: Settings, label: "Settings", active: false },
    ],
  },
];

/** Static presentational Sidebar for Storybook */
function SidebarStatic({ activeLabel = "Applications" }: { activeLabel?: string }) {
  return (
    <aside className="w-60 h-[600px] flex flex-col border-r border-border bg-card rounded-lg overflow-hidden">
      {/* Brand */}
      <div className="px-6 py-5">
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          GMAC.IO
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.label === activeLabel;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">gmackie</span>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

const meta: Meta<typeof SidebarStatic> = {
  title: "Components/Sidebar",
  component: SidebarStatic,
  argTypes: {
    activeLabel: {
      control: "select",
      options: [
        "Dashboard",
        "Applications",
        "Cluster",
        "Registry",
        "Deployments",
        "CI/CD",
        "Alerts",
        "Integrations",
        "Settings",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof SidebarStatic>;

export const Default: Story = {
  args: { activeLabel: "Applications" },
};

export const Infrastructure: Story = {
  args: { activeLabel: "Cluster" },
};

export const Deployments: Story = {
  args: { activeLabel: "Deployments" },
};

export const SettingsActive: Story = {
  args: { activeLabel: "Settings" },
};

export const WithContent: Story = {
  name: "Full Layout",
  render: () => (
    <div className="flex h-[600px] border border-border rounded-lg overflow-hidden">
      <SidebarStatic activeLabel="Applications" />
      <div className="flex-1">
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6">
          <h1 className="font-display text-base font-semibold">Applications</h1>
          <kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-dim">
            ⌘K
          </kbd>
        </header>
        <main className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    </div>
  ),
};
