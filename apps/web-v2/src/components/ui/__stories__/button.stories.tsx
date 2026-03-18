import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Button } from "../button";
import { Play, Plus, Trash2, Settings, LogOut } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
  args: {
    children: "Button",
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Secondary" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Ghost" },
};

export const Link: Story = {
  args: { variant: "link", children: "Link Button" },
};

export const Small: Story = {
  args: { size: "sm", children: "Small" },
};

export const Large: Story = {
  args: { size: "lg", children: "Large" },
};

export const Icon: Story = {
  args: { size: "icon", children: <Settings className="h-4 w-4" /> },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Play className="h-4 w-4" /> Deploy
      </>
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon"><Plus className="h-4 w-4" /></Button>
    </div>
  ),
};

export const ActionBar: Story = {
  name: "Action Bar Pattern",
  render: () => (
    <div className="flex items-center gap-2 p-4 border border-border rounded-lg bg-card">
      <Button size="sm"><Play className="h-3 w-3" /> Deploy</Button>
      <Button variant="outline" size="sm"><Settings className="h-3 w-3" /> Configure</Button>
      <Button variant="ghost" size="sm">View Logs</Button>
      <div className="flex-1" />
      <Button variant="destructive" size="sm"><Trash2 className="h-3 w-3" /> Delete</Button>
    </div>
  ),
};
