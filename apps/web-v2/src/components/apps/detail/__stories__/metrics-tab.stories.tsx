import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Cpu, HardDrive, Activity, AlertTriangle, Timer } from "lucide-react";

const meta: Meta = {
  title: "Detail Tabs/MetricsTab",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const stats = [
      { label: "CPU Usage", value: "23%", icon: Cpu, color: "text-green-500" },
      { label: "Memory", value: "512 MB", icon: HardDrive, color: "text-green-500" },
      { label: "Requests/s", value: "142", icon: Activity, color: "text-blue-500" },
      { label: "Error Rate", value: "0.1%", icon: AlertTriangle, color: "text-green-500" },
      { label: "P95 Latency", value: "142 ms", icon: Timer, color: "text-green-500" },
    ];

    return (
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={cn("h-4 w-4", stat.color)} />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className={cn("text-lg font-mono font-bold tabular-nums", stat.color)}>{stat.value}</p>
            </Card>
          ))}
        </div>
        <p className="font-mono text-[11px] text-dim">
          Metrics sourced from Prometheus. Showing instant values with 5m rate window. Auto-refreshes every 30s.
        </p>
      </div>
    );
  },
};

export const HighUsage: Story = {
  name: "High Usage State",
  render: () => {
    const stats = [
      { label: "CPU Usage", value: "95%", icon: Cpu, color: "text-red-500" },
      { label: "Memory", value: "1,892 MB", icon: HardDrive, color: "text-yellow-500" },
      { label: "Requests/s", value: "2,340", icon: Activity, color: "text-blue-500" },
      { label: "Error Rate", value: "12.5%", icon: AlertTriangle, color: "text-red-500" },
      { label: "P95 Latency", value: "2,400 ms", icon: Timer, color: "text-red-500" },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-4xl">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <p className={cn("text-lg font-mono font-bold tabular-nums", stat.color)}>{stat.value}</p>
          </Card>
        ))}
      </div>
    );
  },
};
