import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { AlertTimeline } from "../alert-timeline";
import { mockAlertEvents } from "@/__mocks__/fixtures";

const meta: Meta<typeof AlertTimeline> = {
  title: "Monitoring/AlertTimeline",
  component: AlertTimeline,
};

export default meta;
type Story = StoryObj<typeof AlertTimeline>;

export const Default: Story = {
  args: { alerts: mockAlertEvents },
};

export const FiringOnly: Story = {
  name: "Firing Only",
  args: { alerts: mockAlertEvents.filter((a) => a.status === "firing") },
};

export const Empty: Story = {
  args: { alerts: [] },
};

export const WithActions: Story = {
  name: "With Acknowledge",
  args: {
    alerts: mockAlertEvents,
    onAcknowledge: (id) => alert(`Acknowledged ${id}`),
  },
};
