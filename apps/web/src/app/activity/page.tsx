"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import Navigation from "@/components/Navigation";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default function ActivityPage() {
  const { authenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authenticated) {
      router.push("/auth/signin");
    }
  }, [authenticated, router]);

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Activity Feed</h1>
          <p className="mt-2 text-gray-400">
            Real-time stream of events across all your applications and integrations
          </p>
        </div>

        {/* Activity Feed */}
        <ActivityFeed showFilters={true} showStats={true} />
      </div>
    </div>
  );
}
