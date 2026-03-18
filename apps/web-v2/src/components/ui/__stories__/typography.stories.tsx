import type { Meta, StoryObj } from "@storybook/react-webpack5";

const meta: Meta = {
  title: "Foundation/Typography",
};

export default meta;
type Story = StoryObj;

export const FontStack: Story = {
  name: "Font Stack",
  render: () => (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">Display — Satoshi</p>
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold">Applications Dashboard</h1>
          <h2 className="font-display text-2xl font-bold">Infrastructure Overview</h2>
          <h3 className="font-display text-lg font-semibold">Cluster Nodes</h3>
          <h4 className="font-display text-base font-semibold">Section Header</h4>
        </div>
      </section>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">Body — Instrument Sans</p>
        <div className="space-y-2">
          <p className="text-base">Body text at 16px — used for descriptions and content.</p>
          <p className="text-sm">Body text at 14px — used for labels and secondary content.</p>
          <p className="text-sm text-muted-foreground">Muted body text — metadata and descriptions.</p>
          <p className="text-xs text-dim">Dim text at 12px — timestamps and tertiary info.</p>
        </div>
      </section>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">Data — Geist Mono</p>
        <div className="space-y-2">
          <p className="font-mono text-lg tabular-nums">1,234,567 requests</p>
          <p className="font-mono text-[13px] tabular-nums">CPU 23% &bull; MEM 512MB &bull; P95 142ms</p>
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">sha:f57fb6f &bull; 2m ago</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-dim">TABLE HEADER</p>
        </div>
      </section>
    </div>
  ),
};

export const TypeScale: Story = {
  name: "Type Scale",
  render: () => (
    <div className="space-y-3">
      {[
        { size: "48px", class: "text-5xl", label: "5xl" },
        { size: "36px", class: "text-4xl", label: "4xl" },
        { size: "30px", class: "text-3xl", label: "3xl" },
        { size: "24px", class: "text-2xl", label: "2xl" },
        { size: "20px", class: "text-xl", label: "xl" },
        { size: "18px", class: "text-lg", label: "lg" },
        { size: "16px", class: "text-base", label: "base" },
        { size: "14px", class: "text-sm", label: "sm" },
        { size: "13px", class: "text-[13px]", label: "13px" },
        { size: "12px", class: "text-xs", label: "xs" },
        { size: "11px", class: "text-[11px]", label: "11px" },
      ].map((item) => (
        <div key={item.label} className="flex items-baseline gap-4">
          <span className="font-mono text-[11px] text-dim w-12 text-right">{item.size}</span>
          <span className={`font-display font-semibold ${item.class}`}>
            GMAC.IO — {item.label}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  name: "Color Palette",
  render: () => (
    <div className="space-y-6">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">Brand</p>
        <div className="flex gap-3">
          <div className="space-y-1.5">
            <div className="h-16 w-16 rounded-md bg-primary" />
            <p className="font-mono text-[11px] text-center">Primary</p>
          </div>
          <div className="space-y-1.5">
            <div className="h-16 w-16 rounded-md bg-secondary" />
            <p className="font-mono text-[11px] text-center">Secondary</p>
          </div>
          <div className="space-y-1.5">
            <div className="h-16 w-16 rounded-md bg-destructive" />
            <p className="font-mono text-[11px] text-center">Destructive</p>
          </div>
        </div>
      </section>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">Semantic</p>
        <div className="flex gap-3">
          {[
            { name: "Success", color: "bg-green-500" },
            { name: "Warning", color: "bg-yellow-500" },
            { name: "Error", color: "bg-red-500" },
            { name: "Info", color: "bg-blue-400" },
          ].map((c) => (
            <div key={c.name} className="space-y-1.5">
              <div className={`h-16 w-16 rounded-md ${c.color}`} />
              <p className="font-mono text-[11px] text-center">{c.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">Surfaces</p>
        <div className="flex gap-3">
          {[
            { name: "Background", color: "bg-background border border-border" },
            { name: "Card", color: "bg-card border border-border" },
            { name: "Muted", color: "bg-muted border border-border" },
            { name: "Accent", color: "bg-accent border border-border" },
          ].map((c) => (
            <div key={c.name} className="space-y-1.5">
              <div className={`h-16 w-16 rounded-md ${c.color}`} />
              <p className="font-mono text-[11px] text-center">{c.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-dim mb-3">Text</p>
        <div className="space-y-1">
          <p className="text-foreground text-sm">Foreground — primary text</p>
          <p className="text-muted-foreground text-sm">Muted Foreground — secondary</p>
          <p className="text-dim text-sm">Dim — tertiary info</p>
        </div>
      </section>
    </div>
  ),
};
