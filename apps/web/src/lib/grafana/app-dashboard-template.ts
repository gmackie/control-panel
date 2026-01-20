export interface AppDashboardTemplateOptions {
  uid: string;
  title: string;
  tags: string[];
  namespace: string;
  podPrefix: string;
}

export function buildAppDashboardTemplate(options: AppDashboardTemplateOptions): any {
  const podRegex = `${escapeRegex(options.podPrefix)}.*`;

  return {
    id: null,
    uid: options.uid,
    title: options.title,
    tags: options.tags,
    timezone: "browser",
    schemaVersion: 38,
    version: 1,
    refresh: "30s",
    panels: [
      {
        datasource: { type: "prometheus", uid: "${datasource}" },
        fieldConfig: {
          defaults: {
            thresholds: {
              mode: "absolute",
              steps: [
                { color: "green", value: null },
                { color: "red", value: 80 },
              ],
            },
            unit: "percent",
          },
        },
        gridPos: { h: 8, w: 12, x: 0, y: 0 },
        id: 1,
        options: {
          orientation: "auto",
          reduceOptions: { calcs: ["lastNotNull"], fields: "", values: false },
          showThresholdLabels: false,
          showThresholdMarkers: true,
        },
        pluginVersion: "10.0.0",
        targets: [
          {
            expr: `(
              sum(rate(container_cpu_usage_seconds_total{namespace="${options.namespace}",pod=~"${podRegex}",container!="POD"}[5m]))
              /
              sum(kube_pod_container_resource_limits{namespace="${options.namespace}",pod=~"${podRegex}",resource="cpu",unit="core"})
            ) * 100`,
            refId: "A",
          },
        ],
        title: "CPU Usage (% of limit)",
        type: "gauge",
      },
      {
        datasource: { type: "prometheus", uid: "${datasource}" },
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: "line",
              fillOpacity: 10,
              lineInterpolation: "linear",
              lineWidth: 1,
              pointSize: 5,
              scaleDistribution: { type: "linear" },
              showPoints: "never",
              spanNulls: true,
            },
            unit: "bytes",
          },
        },
        gridPos: { h: 8, w: 12, x: 12, y: 0 },
        id: 2,
        options: {
          legend: { calcs: [], displayMode: "list", placement: "bottom" },
          tooltip: { mode: "single" },
        },
        pluginVersion: "10.0.0",
        targets: [
          {
            expr: `sum(container_memory_working_set_bytes{namespace="${options.namespace}",pod=~"${podRegex}",container!="POD"})`,
            refId: "A",
          },
        ],
        title: "Memory Working Set (bytes)",
        type: "timeseries",
      },
      {
        datasource: { type: "prometheus", uid: "${datasource}" },
        fieldConfig: {
          defaults: {
            thresholds: {
              mode: "absolute",
              steps: [
                { color: "green", value: null },
                { color: "yellow", value: 1 },
                { color: "red", value: 5 },
              ],
            },
            unit: "short",
          },
        },
        gridPos: { h: 8, w: 12, x: 0, y: 8 },
        id: 3,
        options: {
          colorMode: "value",
          graphMode: "area",
          justifyMode: "auto",
          orientation: "auto",
          reduceOptions: { calcs: ["lastNotNull"], fields: "", values: false },
          textMode: "auto",
        },
        pluginVersion: "10.0.0",
        targets: [
          {
            expr: `sum(increase(kube_pod_container_status_restarts_total{namespace="${options.namespace}",pod=~"${podRegex}"}[1h]))`,
            refId: "A",
          },
        ],
        title: "Pod Restarts (1h)",
        type: "stat",
      },
    ],
    templating: {
      list: [
        {
          current: { selected: false, text: "Prometheus", value: "prometheus" },
          hide: 0,
          includeAll: false,
          label: "Datasource",
          multi: false,
          name: "datasource",
          options: [],
          query: "prometheus",
          refresh: 1,
          regex: "",
          skipUrlSync: false,
          type: "datasource",
        },
      ],
    },
    time: { from: "now-6h", to: "now" },
    timepicker: {},
    weekStart: "",
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
