# ForgeGraph Auto-Rollback Alert Rules for Control-Panel

This document provides copy/paste PrometheusRule snippets and Alertmanager wiring for
control-panel’s `/api/webhooks/prometheus/alerts` endpoint.

## Endpoint

- Webhook URL: `https://<control-panel-host>/api/webhooks/prometheus/alerts`
- Accepted auth:
  - `Authorization: Bearer <PROMETHEUS_WEBHOOK_TOKEN>`
  - `x-webhook-token: <PROMETHEUS_WEBHOOK_TOKEN>` (compatibility fallback)
- Optional request header: `x-request-id`

### Required alert context fields

The webhook handler expects these labels/annotations to map rollback targets:

- `labels.repository` or `labels.repo` or `labels.project` or `labels.repository_name`
- `labels.namespace` (or `labels.environment`)
- `annotations.summary`
- `alerts[0].fingerprint` (for dedupe and correlation)
- `labels.alertname` and `labels.severity` (policy filtering)
- rollback context when available:
  - `labels.source_revision`, `labels.sourceRevision`, or `labels.sha`
  - `labels.source_deployment_id`
  - `annotations.rollback_image_tag` or `labels.rollback_image_tag`

## Recommended alert rule example

```yaml
groups:
  - name: forgegraph.rollback.production
    rules:
      - alert: ForgeProductionCriticalErrorRate
        expr: |
          (
            sum(rate(http_requests_total{code=~"5.."}[5m]))
            /
            clamp_min(sum(rate(http_requests_total[5m])), 1)
          ) * 100 > 2
        for: 2m
        labels:
          severity: critical
          service: my-service
          namespace: production
          environment: production
          repository: my-org/my-service
          source_revision: "${IMAGE_TAG}"
          source_deployment_id: "${POD_NAME}"
          rollback_image_tag: "${PREVIOUS_HEALTHY_IMAGE_TAG}"
        annotations:
          summary: "Production error rate spike on my-service"
          description: "HTTP 5xx ratio exceeded 2% over 2m window."
          runbook_url: "https://docs.example.com/runbooks/my-service-deployments#rollback"
```

## Alertmanager receiver example

```yaml
route:
  group_by: ["alertname", "namespace", "repository", "service"]
  receiver: "forgegraph-control-panel"

receivers:
  - name: "forgegraph-control-panel"
    webhook_configs:
      - url: "https://control-panel.example.com/api/webhooks/prometheus/alerts"
        send_resolved: false
        http_config:
          bearer_token: "${PROMETHEUS_WEBHOOK_TOKEN}"
          # Optional compatibility alternative:
          # basic_auth: { password: "${PROMETHEUS_WEBHOOK_TOKEN}" }
```

## Suggested policy defaults

- Severities: `critical`
- Environment filter: `production,staging` (split by comma in control-panel config)
- Dedupe window: `300000` ms
- Require a valid rollback target (`sourceDeploymentId` or `rollbackImageTag`) in the payload

## Example control-panel config mapping

Set these in env/secret and pod env injection:

- `FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN`
- `FORGEGRAPH_API_URL`
- `PROMETHEUS_WEBHOOK_TOKEN` (or `PROMETHEUS_BEARER_TOKEN`)
- `FORGEGRAPH_AUTO_ROLLBACK_ENABLED=true`
- `FORGEGRAPH_AUTO_ROLLBACK_SEVERITIES=critical`
- `FORGEGRAPH_AUTO_ROLLBACK_ENVIRONMENTS=production`
- `FORGEGRAPH_ROLLBACK_DEDUPE_WINDOW_MS=300000`
