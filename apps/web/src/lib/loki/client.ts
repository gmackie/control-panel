type LokiQueryDirection = "forward" | "backward";

export interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][];
}

export interface LokiQueryRangeResult {
  status: "success" | "error";
  data: {
    resultType: "streams" | string;
    result: LokiStream[];
  };
}

export interface LokiQueryRangeOptions {
  query: string;
  startNs?: string;
  endNs?: string;
  limit?: number;
  direction?: LokiQueryDirection;
}

export class LokiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || process.env.LOKI_URL || "http://loki-gateway.monitoring.svc.cluster.local").replace(
      /\/$/,
      ""
    );
  }

  async queryRange(options: LokiQueryRangeOptions): Promise<LokiQueryRangeResult> {
    const url = new URL(`${this.baseUrl}/loki/api/v1/query_range`);

    url.searchParams.set("query", options.query);
    if (options.startNs) url.searchParams.set("start", options.startNs);
    if (options.endNs) url.searchParams.set("end", options.endNs);
    if (typeof options.limit === "number") url.searchParams.set("limit", String(options.limit));
    if (options.direction) url.searchParams.set("direction", options.direction);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await safeReadText(res);
      throw new Error(`Loki query_range failed: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`);
    }

    return (await res.json()) as LokiQueryRangeResult;
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
