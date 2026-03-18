"use client";

import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground font-display">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold mb-4">GMAC.IO Control Panel</h1>
          <p className="text-muted-foreground mb-6">Sign in to continue.</p>
          <a
            href="/api/auth/signin/github"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Sign in with GitHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-60">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
