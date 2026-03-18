import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { AppSlideOver } from "../app-slide-over";
import { healthyApp, degradedApp, unhealthyApp } from "@/__mocks__/fixtures";

const meta: Meta<typeof AppSlideOver> = {
  title: "Components/AppSlideOver",
  component: AppSlideOver,
  args: {
    onClose: () => {},
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof AppSlideOver>;

export const Healthy: Story = {
  args: { app: healthyApp },
};

export const Degraded: Story = {
  args: { app: degradedApp },
};

export const Unhealthy: Story = {
  args: { app: unhealthyApp },
};

export const Closed: Story = {
  args: { app: null },
};
