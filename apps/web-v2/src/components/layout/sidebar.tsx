"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutGrid,
  Server,
  Settings,
  Rocket,
  Activity,
  Plug,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const sections = [
  {
    label: "Monitor",
    items: [
      { href: "/", icon: LayoutGrid, label: "Applications" },
      { href: "/infrastructure", icon: Server, label: "Infrastructure" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/releases", icon: Rocket, label: "Releases" },
      { href: "/monitoring", icon: Activity, label: "Monitoring" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/integrations", icon: Plug, label: "Integrations" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  function isActive(href: string) {
    if (href === "/" || href === "/apps") {
      return pathname === "/" || pathname === "/apps" || pathname.startsWith("/apps/");
    }
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-60 flex flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="px-6 py-5">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-foreground">
          GMAC.IO
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">
            {session?.user?.name ?? "User"}
          </span>
          <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out" className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
