import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { HealthOverviewStrip } from "../health-overview-strip";
import { AlertTimeline } from "../alert-timeline";
import { AppHealthGrid } from "../app-health-grid";
import { mockHealthMetrics, mockAlertEvents, mockAppHealth } from "@/__mocks__/fixtures";

const meta: Meta = {
  title: "Pages/Monitoring",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System-wide health, alerts, and application status
        </p>
      </div>

      <HealthOverviewStrip metrics={mockHealthMetrics} />

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Alerts</h2>
        <AlertTimeline alerts={mockAlertEvents} />
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Application Health</h2>
        <AppHealthGrid apps={mockAppHealth} />
      </section>
    </div>
  ),
};
