import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Switch } from "../switch";
import { Label } from "../label";

const meta: Meta<typeof Switch> = {
  title: "Primitives/Switch",
  component: Switch,
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch id="auto-deploy" defaultChecked />
      <Label htmlFor="auto-deploy">Auto-deploy on push</Label>
    </div>
  ),
};
