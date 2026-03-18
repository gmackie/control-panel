import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { EditableText } from "../editable-text";

const meta: Meta<typeof EditableText> = {
  title: "Primitives/EditableText",
  component: EditableText,
  args: {
    value: "control-panel",
    onSave: async (v) => {
      await new Promise((r) => setTimeout(r, 500));
    },
  },
};

export default meta;
type Story = StoryObj<typeof EditableText>;

export const Default: Story = {};

export const AsHeading: Story = {
  args: {
    value: "My Application",
    as: "h2",
    className: "font-display text-2xl font-bold",
  },
};

export const Empty: Story = {
  args: { value: "", emptyText: "Click to add a name..." },
};

export const Disabled: Story = {
  args: { disabled: true },
};
