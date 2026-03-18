import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Badge } from "../badge";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "success", "warning", "error"],
    },
  },
  args: {
    children: "Badge",
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: "secondary", children: "secondary" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "outline" },
};

export const Success: Story = {
  args: { variant: "success", children: "healthy" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "degraded" },
};

export const Error: Story = {
  args: { variant: "error", children: "critical" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">default</Badge>
      <Badge variant="secondary">secondary</Badge>
      <Badge variant="destructive">destructive</Badge>
      <Badge variant="outline">outline</Badge>
      <Badge variant="success">success</Badge>
      <Badge variant="warning">warning</Badge>
      <Badge variant="error">error</Badge>
    </div>
  ),
};

export const StatusBadges: Story = {
  name: "Status Badge Pattern",
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success" className="font-mono text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5" />
        Running
      </Badge>
      <Badge variant="warning" className="font-mono text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 mr-1.5" />
        Degraded
      </Badge>
      <Badge variant="error" className="font-mono text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5" />
        Down
      </Badge>
      <Badge variant="secondary" className="font-mono text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mr-1.5" />
        Deploying
      </Badge>
    </div>
  ),
};
