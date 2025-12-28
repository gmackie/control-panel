/**
 * Prometheus API Client
 * Connects to Prometheus in the K8s cluster to fetch real metrics
 */

export interface PrometheusConfig {
  url: string;
  bearerToken?: string;
}

export interface PrometheusValue {
  timestamp: number;
  value: string;
}

export interface PrometheusMetric {
  __name__?: string;
  [key: string]: string | undefined;
}

export interface PrometheusInstantResult {
  metric: PrometheusMetric;
  value: [number, string]; // [timestamp, value]
}

export interface PrometheusRangeResult {
  metric: PrometheusMetric;
  values: Array<[number, string]>; // [[timestamp, value], ...]
}

export interface PrometheusResponse<T> {
  status: 'success' | 'error';
  data: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string';
    result: T[];
  };
  errorType?: string;
  error?: string;
}

export interface PrometheusTarget {
  labels: Record<string, string>;
  scrapePool: string;
  scrapeUrl: string;
  globalUrl: string;
  lastError: string;
  lastScrape: string;
  lastScrapeDuration: number;
  health: 'up' | 'down' | 'unknown';
}

export interface PrometheusAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: 'firing' | 'pending' | 'inactive';
  activeAt: string;
  value: string;
}

export interface PrometheusRule {
  name: string;
  query: string;
  duration: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  alerts: PrometheusAlert[];
  health: 'ok' | 'err' | 'unknown';
  lastError: string;
  type: 'alerting' | 'recording';
}

export interface PrometheusRuleGroup {
  name: string;
  file: string;
  rules: PrometheusRule[];
  interval: number;
}

export class PrometheusClient {
  private config: PrometheusConfig;

  constructor(config?: Partial<PrometheusConfig>) {
    this.config = {
      url: config?.url || process.env.PROMETHEUS_URL || 'http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090',
      bearerToken: config?.bearerToken || process.env.PROMETHEUS_BEARER_TOKEN,
    };
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.config.url);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.config.bearerToken) {
      headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute an instant query at a single point in time
   */
  async instantQuery(query: string, time?: Date): Promise<PrometheusInstantResult[]> {
    const params: Record<string, string> = { query };
    if (time) {
      params.time = (time.getTime() / 1000).toString();
    }

    const response = await this.request<PrometheusResponse<PrometheusInstantResult>>(
      '/api/v1/query',
      params
    );

    if (response.status !== 'success') {
      throw new Error(`Prometheus query error: ${response.error}`);
    }

    return response.data.result;
  }

  /**
   * Execute a range query over a time period
   */
  async rangeQuery(
    query: string,
    start: Date,
    end: Date,
    step: string = '15s'
  ): Promise<PrometheusRangeResult[]> {
    const params: Record<string, string> = {
      query,
      start: (start.getTime() / 1000).toString(),
      end: (end.getTime() / 1000).toString(),
      step,
    };

    const response = await this.request<PrometheusResponse<PrometheusRangeResult>>(
      '/api/v1/query_range',
      params
    );

    if (response.status !== 'success') {
      throw new Error(`Prometheus query error: ${response.error}`);
    }

    return response.data.result;
  }

  /**
   * Get all active targets
   */
  async getTargets(): Promise<{ activeTargets: PrometheusTarget[]; droppedTargets: any[] }> {
    const response = await this.request<{
      status: string;
      data: { activeTargets: PrometheusTarget[]; droppedTargets: any[] };
    }>('/api/v1/targets');

    return response.data;
  }

  /**
   * Get all active alerts
   */
  async getAlerts(): Promise<PrometheusAlert[]> {
    const response = await this.request<{
      status: string;
      data: { alerts: PrometheusAlert[] };
    }>('/api/v1/alerts');

    return response.data.alerts;
  }

  /**
   * Get all alerting and recording rules
   */
  async getRules(): Promise<PrometheusRuleGroup[]> {
    const response = await this.request<{
      status: string;
      data: { groups: PrometheusRuleGroup[] };
    }>('/api/v1/rules');

    return response.data.groups;
  }

  /**
   * Get all label values for a given label name
   */
  async getLabelValues(labelName: string): Promise<string[]> {
    const response = await this.request<{
      status: string;
      data: string[];
    }>(`/api/v1/label/${labelName}/values`);

    return response.data;
  }

  /**
   * Get all label names
   */
  async getLabels(): Promise<string[]> {
    const response = await this.request<{
      status: string;
      data: string[];
    }>('/api/v1/labels');

    return response.data;
  }

  /**
   * Check Prometheus health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/-/healthy`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get common application metrics
   */
  async getApplicationMetrics(namespace: string, appName: string): Promise<{
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    latency: number;
  }> {
    try {
      // CPU usage
      const cpuQuery = `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${appName}.*"}[5m])) * 100`;
      const cpuResult = await this.instantQuery(cpuQuery);
      const cpu = cpuResult.length > 0 ? parseFloat(cpuResult[0].value[1]) : 0;

      // Memory usage in MB
      const memoryQuery = `sum(container_memory_working_set_bytes{namespace="${namespace}",pod=~"${appName}.*"}) / 1024 / 1024`;
      const memoryResult = await this.instantQuery(memoryQuery);
      const memory = memoryResult.length > 0 ? parseFloat(memoryResult[0].value[1]) : 0;

      // Request rate (if using standard metrics)
      const requestsQuery = `sum(rate(http_requests_total{namespace="${namespace}",pod=~"${appName}.*"}[5m])) or vector(0)`;
      const requestsResult = await this.instantQuery(requestsQuery);
      const requests = requestsResult.length > 0 ? parseFloat(requestsResult[0].value[1]) : 0;

      // Error rate
      const errorsQuery = `sum(rate(http_requests_total{namespace="${namespace}",pod=~"${appName}.*",status=~"5.."}[5m])) / sum(rate(http_requests_total{namespace="${namespace}",pod=~"${appName}.*"}[5m])) * 100 or vector(0)`;
      const errorsResult = await this.instantQuery(errorsQuery);
      const errors = errorsResult.length > 0 ? parseFloat(errorsResult[0].value[1]) : 0;

      // P95 latency in ms
      const latencyQuery = `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="${namespace}",pod=~"${appName}.*"}[5m])) by (le)) * 1000 or vector(0)`;
      const latencyResult = await this.instantQuery(latencyQuery);
      const latency = latencyResult.length > 0 ? parseFloat(latencyResult[0].value[1]) : 0;

      return {
        cpu: Math.round(cpu * 100) / 100,
        memory: Math.round(memory),
        requests: Math.round(requests * 100) / 100,
        errors: Math.round(errors * 100) / 100,
        latency: Math.round(latency),
      };
    } catch (error) {
      console.error('Error fetching application metrics:', error);
      return { cpu: 0, memory: 0, requests: 0, errors: 0, latency: 0 };
    }
  }

  /**
   * Get cluster-wide metrics
   */
  async getClusterMetrics(): Promise<{
    nodeCount: number;
    podCount: number;
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    cpuCores: number;
    memoryGi: number;
  }> {
    try {
      // Node count
      const nodeQuery = 'count(kube_node_info)';
      const nodeResult = await this.instantQuery(nodeQuery);
      const nodeCount = nodeResult.length > 0 ? parseInt(nodeResult[0].value[1]) : 0;

      // Pod count
      const podQuery = 'count(kube_pod_info)';
      const podResult = await this.instantQuery(podQuery);
      const podCount = podResult.length > 0 ? parseInt(podResult[0].value[1]) : 0;

      // CPU usage percentage
      const cpuQuery = '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)';
      const cpuResult = await this.instantQuery(cpuQuery);
      const cpuUsagePercent = cpuResult.length > 0 ? parseFloat(cpuResult[0].value[1]) : 0;

      // Memory usage percentage
      const memQuery = '(1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))) * 100';
      const memResult = await this.instantQuery(memQuery);
      const memoryUsagePercent = memResult.length > 0 ? parseFloat(memResult[0].value[1]) : 0;

      // Total CPU cores
      const coresQuery = 'sum(machine_cpu_cores)';
      const coresResult = await this.instantQuery(coresQuery);
      const cpuCores = coresResult.length > 0 ? parseInt(coresResult[0].value[1]) : 0;

      // Total memory in GiB
      const memTotalQuery = 'sum(node_memory_MemTotal_bytes) / 1024 / 1024 / 1024';
      const memTotalResult = await this.instantQuery(memTotalQuery);
      const memoryGi = memTotalResult.length > 0 ? parseFloat(memTotalResult[0].value[1]) : 0;

      return {
        nodeCount,
        podCount,
        cpuUsagePercent: Math.round(cpuUsagePercent * 100) / 100,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        cpuCores,
        memoryGi: Math.round(memoryGi * 100) / 100,
      };
    } catch (error) {
      console.error('Error fetching cluster metrics:', error);
      return { nodeCount: 0, podCount: 0, cpuUsagePercent: 0, memoryUsagePercent: 0, cpuCores: 0, memoryGi: 0 };
    }
  }
}
