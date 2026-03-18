import { NodeGrid } from "@/components/infra/node-grid";
import { PodTable } from "@/components/infra/pod-table";
import { CostSummary } from "@/components/infra/cost-summary";

export default function InfrastructurePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Infrastructure</h1>
        <p className="text-sm text-muted-foreground mt-1">Cluster health, pods, and costs</p>
      </div>
      <NodeGrid />
      <PodTable />
      <CostSummary />
    </div>
  );
}
