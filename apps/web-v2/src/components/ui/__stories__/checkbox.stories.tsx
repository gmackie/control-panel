import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Checkbox } from "../checkbox";
import { Label } from "../label";

const meta: Meta<typeof Checkbox> = {
  title: "Primitives/Checkbox",
  component: Checkbox,
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};

export const CheckboxGroup: Story = {
  name: "Checkbox Group",
  render: () => (
    <div className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-dim">Notifications</p>
      {[
        { id: "slack", label: "Slack", checked: true },
        { id: "email", label: "Email", checked: true },
        { id: "pagerduty", label: "PagerDuty", checked: false },
        { id: "webhook", label: "Webhook", checked: false },
      ].map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <Checkbox id={item.id} defaultChecked={item.checked} />
          <Label htmlFor={item.id}>{item.label}</Label>
        </div>
      ))}
    </div>
  ),
};
