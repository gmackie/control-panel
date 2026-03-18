import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../card";
import { Button } from "../button";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Card content area.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="w-[350px] p-4">
      <p className="text-xs text-muted-foreground mb-1">Hetzner Servers</p>
      <p className="text-2xl font-mono font-bold tabular-nums">3</p>
      <p className="text-xs text-muted-foreground mt-1">
        2 running &bull; <span className="font-mono tabular-nums">&euro;12.50/mo</span>
      </p>
    </Card>
  ),
};

export const MetricCard: Story = {
  name: "Metric Card Pattern",
  render: () => (
    <div className="grid grid-cols-3 gap-3 max-w-xl">
      <Card className="p-4">
        <p className="text-xs text-muted-foreground mb-1">CPU Usage</p>
        <p className="text-lg font-mono font-bold tabular-nums text-green-500">23%</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground mb-1">Memory</p>
        <p className="text-lg font-mono font-bold tabular-nums text-yellow-500">512 MB</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground mb-1">Error Rate</p>
        <p className="text-lg font-mono font-bold tabular-nums text-red-500">3.2%</p>
      </Card>
    </div>
  ),
};

export const WithBorder: Story = {
  name: "Warning State",
  render: () => (
    <Card className="w-[350px] p-4 border-yellow-600/30">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
        <span className="font-display font-semibold text-sm">my-app</span>
      </div>
      <p className="text-xs text-muted-foreground">1/2 pods ready — degraded</p>
    </Card>
  ),
};
