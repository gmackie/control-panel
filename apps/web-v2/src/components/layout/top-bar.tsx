"use client";

import { useSession, signOut } from "next-auth/react";
import { ClusterStatusIndicator } from "./cluster-status-indicator";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function TopBar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-medium text-muted-foreground">GMAC.IO</h1>
        <ClusterStatusIndicator />
      </div>
      <div className="flex items-center gap-3">
        {session?.user?.name && (
          <span className="text-sm text-muted-foreground">{session.user.name}</span>
        )}
        <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
