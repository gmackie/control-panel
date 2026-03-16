import { metrics } from "@/lib/metrics/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/metrics
 *
 * Prometheus-compatible scrape endpoint.
 * Returns all collected counters and histograms in the text exposition format.
 */
export function GET() {
  const body = metrics.format();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
