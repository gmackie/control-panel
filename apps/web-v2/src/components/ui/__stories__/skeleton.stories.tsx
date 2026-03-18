import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Skeleton } from "../skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Primitives/Skeleton",
  component: Skeleton,
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => <Skeleton className="h-8 w-48" />,
};

export const CardSkeleton: Story = {
  name: "Card Loading State",
  render: () => (
    <div className="w-[350px] space-y-3 p-4 border border-border rounded-xl">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-48" />
    </div>
  ),
};

export const TableSkeleton: Story = {
  name: "Table Loading State",
  render: () => (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  ),
};
