/**
 * Next.js Instrumentation Hook
 *
 * Auto-starts the ClusterHealthWatcher on server boot.
 * Seeds default notification rules before starting the watcher.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Delay 5s to let the app fully initialize (database, env vars, etc.)
    setTimeout(async () => {
      try {
        const { seedClusterHealthRules } = await import(
          "@/lib/monitoring/seed-health-rules"
        );
        await seedClusterHealthRules();

        const { getClusterHealthWatcher } = await import(
          "@/lib/monitoring/cluster-health-watcher"
        );
        const watcher = getClusterHealthWatcher();
        await watcher.start();
        console.log("[instrumentation] ClusterHealthWatcher started");
      } catch (error) {
        console.error(
          "[instrumentation] Failed to start ClusterHealthWatcher:",
          error
        );
      }
    }, 5000);
  }
}
