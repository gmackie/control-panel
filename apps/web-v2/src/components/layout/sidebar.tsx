"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Server, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Apps" },
  { href: "/infrastructure", icon: Server, label: "Infrastructure" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-16 flex flex-col items-center py-4 gap-2 border-r border-border bg-card">
      <Link href="/" className="mb-4 text-lg font-bold text-primary">G</Link>
      {navItems.map((item) => {
        const isActive = item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </Link>
        );
      })}
    </aside>
  );
}
