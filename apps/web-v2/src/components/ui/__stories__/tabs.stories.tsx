import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs";
import { Card } from "../card";

const meta: Meta = {
  title: "Primitives/Tabs",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="deployments">Deployments</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Overview content goes here.</p>
        </Card>
      </TabsContent>
      <TabsContent value="deployments">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Deployment history goes here.</p>
        </Card>
      </TabsContent>
      <TabsContent value="logs">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Log output goes here.</p>
        </Card>
      </TabsContent>
      <TabsContent value="metrics">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Metrics dashboard goes here.</p>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export const AppDetailTabs: Story = {
  name: "App Detail Pattern",
  render: () => {
    const tabs = ["Overview", "Deployments", "Logs", "Metrics", "Registry", "Alerts", "Settings"];
    return (
      <div>
        <div className="flex items-center gap-1 border-b border-border mb-6">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                i === 0
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Tab content renders here.</p>
      </div>
    );
  },
};
