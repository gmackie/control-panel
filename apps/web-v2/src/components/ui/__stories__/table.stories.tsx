import type { Meta, StoryObj } from "@storybook/react-webpack5";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../table";
import { Badge } from "../badge";

const meta: Meta = {
  title: "Primitives/Table",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono text-[11px] uppercase tracking-wider">Name</TableHead>
          <TableHead className="font-mono text-[11px] uppercase tracking-wider">Status</TableHead>
          <TableHead className="font-mono text-[11px] uppercase tracking-wider">Environment</TableHead>
          <TableHead className="font-mono text-[11px] uppercase tracking-wider text-right">Replicas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-mono text-[13px] font-medium">control-panel</TableCell>
          <TableCell><Badge variant="success" className="font-mono text-[11px]">Running</Badge></TableCell>
          <TableCell className="font-mono text-[13px] text-muted-foreground">production</TableCell>
          <TableCell className="font-mono text-[13px] tabular-nums text-right">2/2</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-mono text-[13px] font-medium">api-gateway</TableCell>
          <TableCell><Badge variant="error" className="font-mono text-[11px]">Failed</Badge></TableCell>
          <TableCell className="font-mono text-[13px] text-muted-foreground">production</TableCell>
          <TableCell className="font-mono text-[13px] tabular-nums text-right">0/3</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-mono text-[13px] font-medium">gmac-web</TableCell>
          <TableCell><Badge variant="warning" className="font-mono text-[11px]">Degraded</Badge></TableCell>
          <TableCell className="font-mono text-[13px] text-muted-foreground">production</TableCell>
          <TableCell className="font-mono text-[13px] tabular-nums text-right">1/2</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-mono text-[13px] font-medium">docs-site</TableCell>
          <TableCell><Badge variant="success" className="font-mono text-[11px]">Running</Badge></TableCell>
          <TableCell className="font-mono text-[13px] text-muted-foreground">staging</TableCell>
          <TableCell className="font-mono text-[13px] tabular-nums text-right">1/1</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
