import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Button } from "@/components/ui/button";

const meta: Meta = {
  title: "Components/AppShell",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const Loading: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[400px] bg-background">
      <div className="animate-pulse text-muted-foreground font-display">Loading...</div>
    </div>
  ),
};

export const Unauthenticated: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[400px] bg-background">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold mb-4">GMAC.IO Control Panel</h1>
        <p className="text-muted-foreground mb-6">Sign in to continue.</p>
        <Button>Sign in with GitHub</Button>
      </div>
    </div>
  ),
};
