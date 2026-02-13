import { Suspense } from "react";
import ApplicationsPageClient from "./ApplicationsPageClient";

export default function ApplicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="animate-pulse text-gray-400">Loading applications...</div>
        </div>
      }
    >
      <ApplicationsPageClient />
    </Suspense>
  );
}
