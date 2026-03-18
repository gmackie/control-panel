import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Alert, AlertTitle, AlertDescription } from "../alert";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const meta: Meta<typeof Alert> = {
  title: "Primitives/Alert",
  component: Alert,
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        This is an informational alert with default styling.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Deployment failed — image pull error on k3s-worker-1.
      </AlertDescription>
    </Alert>
  ),
};
