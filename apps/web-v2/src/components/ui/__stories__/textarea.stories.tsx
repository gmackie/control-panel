import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Textarea } from "../textarea";
import { Label } from "../label";

const meta: Meta<typeof Textarea> = {
  title: "Primitives/Textarea",
  component: Textarea,
  args: {
    placeholder: "Type your message here...",
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 max-w-sm">
      <Label htmlFor="description">Description</Label>
      <Textarea id="description" placeholder="Describe the application..." />
    </div>
  ),
};
