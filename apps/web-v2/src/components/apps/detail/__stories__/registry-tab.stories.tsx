import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Badge } from "@/components/ui/badge";

const meta: Meta = {
  title: "Detail Tabs/RegistryTab",
};

export default meta;
type Story = StoryObj;

const artifacts = [
  {
    tags: ["latest", "v1.4.2"],
    digest: "sha256:f57fb6f",
    size: "142.3 MB",
    pushed: "12 minutes ago",
    vulns: { critical: 0, high: 0, medium: 2, total: 2 },
  },
  {
    tags: ["v1.4.1"],
    digest: "sha256:e624865",
    size: "141.8 MB",
    pushed: "1 day ago",
    vulns: { critical: 1, high: 3, medium: 5, total: 9 },
  },
  {
    tags: ["v1.4.0"],
    digest: "sha256:9273199",
    size: "140.2 MB",
    pushed: "3 days ago",
    vulns: { critical: 0, high: 0, medium: 0, total: 0 },
  },
  {
    tags: [],
    digest: "sha256:abc1234",
    size: "138.9 MB",
    pushed: "5 days ago",
    vulns: null,
  },
];

export const Default: Story = {
  render: () => (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Container Images ({artifacts.length})</h3>
        <span className="font-mono text-[11px] text-muted-foreground">library/control-panel</span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Tags</th>
              <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Digest</th>
              <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Size</th>
              <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Pushed</th>
              <th className="text-left font-mono text-[11px] uppercase tracking-wider text-dim px-4 py-2">Vulnerabilities</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((a) => (
              <tr key={a.digest} className="border-b border-border/50 last:border-0 hover:bg-accent/50">
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {a.tags.length > 0 ? a.tags.map((tag) => (
                      <Badge key={tag} variant={tag === "latest" ? "default" : "secondary"} className="font-mono text-[11px]">
                        {tag}
                      </Badge>
                    )) : (
                      <span className="text-muted-foreground font-mono text-[11px]">untagged</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-muted-foreground">{a.digest}</code></td>
                <td className="px-4 py-2.5 font-mono text-[13px] tabular-nums text-muted-foreground">{a.size}</td>
                <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">{a.pushed}</td>
                <td className="px-4 py-2.5">
                  {a.vulns ? (
                    <div className="flex items-center gap-1.5">
                      {a.vulns.critical > 0 && <Badge variant="error" className="font-mono text-[11px]">C: {a.vulns.critical}</Badge>}
                      {a.vulns.high > 0 && <Badge className="font-mono text-[11px] bg-orange-500/10 text-orange-500 border-orange-500/20">H: {a.vulns.high}</Badge>}
                      {a.vulns.medium > 0 && <Badge variant="warning" className="font-mono text-[11px]">M: {a.vulns.medium}</Badge>}
                      {a.vulns.total === 0 && <Badge variant="success" className="font-mono text-[11px]">Clean</Badge>}
                    </div>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground">Not scanned</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
};
