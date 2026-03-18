import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ProviderBadge } from "../provider-badge";

const meta: Meta<typeof ProviderBadge> = {
  title: "Components/ProviderBadge",
  component: ProviderBadge,
  argTypes: {
    provider: {
      control: "select",
      options: ["k8s", "vercel", "gitea", "github"],
    },
  },
  args: {
    provider: "k8s",
  },
};

export default meta;
type Story = StoryObj<typeof ProviderBadge>;

export const K8s: Story = {};

export const Vercel: Story = {
  args: { provider: "vercel" },
};

export const Gitea: Story = {
  args: { provider: "gitea" },
};

export const GitHub: Story = {
  args: { provider: "github" },
};

export const AllProviders: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <ProviderBadge provider="k8s" />
      <ProviderBadge provider="vercel" />
      <ProviderBadge provider="gitea" />
      <ProviderBadge provider="github" />
    </div>
  ),
};
