/**
 * Lightweight in-memory Prometheus metrics collector.
 *
 * Stores counters and histograms in Maps and can serialise them
 * into the Prometheus text exposition format (v0.0.4).
 */

const HISTOGRAM_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

// ---------------------------------------------------------------------------
// Internal storage types
// ---------------------------------------------------------------------------

/** Counter values keyed by a serialised label set. */
interface CounterMetric {
  type: "counter";
  help: string;
  /** Map<serialisedLabels, value> */
  values: Map<string, { labels: Record<string, string>; value: number }>;
}

/** Histogram values keyed by a serialised label set. */
interface HistogramMetric {
  type: "histogram";
  help: string;
  values: Map<
    string,
    {
      labels: Record<string, string>;
      bucketCounts: number[]; // one per HISTOGRAM_BUCKETS entry
      sum: number;
      count: number;
    }
  >;
}

type Metric = CounterMetric | HistogramMetric;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serialiseLabels(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}="${labels[k]}"`).join(",");
}

function formatLabels(labels: Record<string, string>): string {
  const s = serialiseLabels(labels);
  return s ? `{${s}}` : "";
}

// ---------------------------------------------------------------------------
// MetricsCollector
// ---------------------------------------------------------------------------

export class MetricsCollector {
  private metrics = new Map<string, Metric>();
  private startedAt = Date.now();

  // -- public API -----------------------------------------------------------

  /**
   * Increment (or initialise) a counter metric.
   */
  incrementCounter(
    name: string,
    labels: Record<string, string> = {},
    amount = 1,
  ): void {
    let metric = this.metrics.get(name) as CounterMetric | undefined;
    if (!metric) {
      metric = { type: "counter", help: name, values: new Map() };
      this.metrics.set(name, metric);
    }

    const key = serialiseLabels(labels);
    const existing = metric.values.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      metric.values.set(key, { labels, value: amount });
    }
  }

  /**
   * Record a single observation for a histogram metric.
   */
  observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    let metric = this.metrics.get(name) as HistogramMetric | undefined;
    if (!metric) {
      metric = { type: "histogram", help: name, values: new Map() };
      this.metrics.set(name, metric);
    }

    const key = serialiseLabels(labels);
    let entry = metric.values.get(key);
    if (!entry) {
      entry = {
        labels,
        bucketCounts: new Array(HISTOGRAM_BUCKETS.length).fill(0) as number[],
        sum: 0,
        count: 0,
      };
      metric.values.set(key, entry);
    }

    entry.sum += value;
    entry.count += 1;
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
      if (value <= HISTOGRAM_BUCKETS[i]) {
        entry.bucketCounts[i] += 1;
      }
    }
  }

  /**
   * Serialise all collected metrics into Prometheus exposition format.
   */
  format(): string {
    const lines: string[] = [];

    // Built-in uptime gauge
    const uptimeSeconds = (Date.now() - this.startedAt) / 1000;
    lines.push("# HELP process_uptime_seconds Time since the process started");
    lines.push("# TYPE process_uptime_seconds gauge");
    lines.push(`process_uptime_seconds ${uptimeSeconds}`);
    lines.push("");

    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      if (metric.type === "counter") {
        for (const entry of metric.values.values()) {
          lines.push(`${name}${formatLabels(entry.labels)} ${entry.value}`);
        }
      } else {
        // histogram
        for (const entry of metric.values.values()) {
          const lbl = formatLabels(entry.labels);
          const lblComma =
            Object.keys(entry.labels).length > 0
              ? serialiseLabels(entry.labels) + ","
              : "";

          let cumulative = 0;
          for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
            cumulative += entry.bucketCounts[i];
            lines.push(
              `${name}_bucket{${lblComma}le="${HISTOGRAM_BUCKETS[i]}"} ${cumulative}`,
            );
          }
          lines.push(
            `${name}_bucket{${lblComma}le="+Inf"} ${entry.count}`,
          );
          lines.push(`${name}_sum${lbl} ${entry.sum}`);
          lines.push(`${name}_count${lbl} ${entry.count}`);
        }
      }

      lines.push("");
    }

    return lines.join("\n");
  }
}

/** Singleton metrics instance shared across the application. */
export const metrics = new MetricsCollector();
