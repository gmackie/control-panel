import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getRollbackPolicyConfig,
  evaluateAlertRollback,
  evaluateBatchRollback,
  _resetDedupeMap,
} from "../rollback-policy";

const mockAlert = {
  status: "firing" as const,
  labels: {
    alertname: "test-alert",
    severity: "critical",
    namespace: "production",
    repository: "acme/svc",
    source_revision: "abc123",
  },
  annotations: { summary: "test" },
  startsAt: new Date().toISOString(),
  endsAt: new Date().toISOString(),
  fingerprint: "fp-1",
};

const mockPayload = {
  status: "firing" as const,
  alerts: [mockAlert],
  commonLabels: { namespace: "production" },
};

function clearRollbackEnvVars() {
  delete process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED;
  delete process.env.PROMETHEUS_AUTO_ROLLBACK_ENABLED;
  delete process.env.FORGEGRAPH_AUTO_ROLLBACK_SEVERITIES;
  delete process.env.PROMETHEUS_AUTO_ROLLBACK_SEVERITIES;
  delete process.env.FORGEGRAPH_AUTO_ROLLBACK_ENVIRONMENTS;
  delete process.env.PROMETHEUS_AUTO_ROLLBACK_ENVIRONMENTS;
  delete process.env.FORGEGRAPH_ROLLBACK_DRY_RUN;
  delete process.env.FORGEGRAPH_ROLLBACK_DEDUPE_WINDOW_MS;
  delete process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN;
  delete process.env.CONTROL_PLANE_WEBHOOK_TOKEN;
  delete process.env.FORGEGRAPH_WEBHOOK_TOKEN;
  delete process.env.PROMETHEUS_WEBHOOK_TOKEN;
  delete process.env.PROMETHEUS_BEARER_TOKEN;
  delete process.env.FORGEGRAPH_API_URL;
  delete process.env.LINEAR_CLONE_URL;
  delete process.env.NEXT_PUBLIC_TASK_URL;
}

describe("rollback-policy", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...savedEnv };
    clearRollbackEnvVars();
    _resetDedupeMap();
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('returns action "disabled" when rollback is not enabled', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = "false";
    const result = await evaluateAlertRollback(mockAlert, mockPayload);
    expect(result.action).toBe("disabled");
  });

  it('returns action "skipped" when alert severity does not match', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = "true";
    process.env.PROMETHEUS_BEARER_TOKEN = "tok";
    process.env.FORGEGRAPH_API_URL = "https://fg.test";

    const infoAlert = {
      ...mockAlert,
      labels: { ...mockAlert.labels, severity: "info" },
      fingerprint: "fp-info",
    };
    const result = await evaluateAlertRollback(infoAlert, mockPayload);
    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("Severity");
  });

  it('returns action "skipped" when alert environment does not match', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = "true";
    process.env.PROMETHEUS_BEARER_TOKEN = "tok";
    process.env.FORGEGRAPH_API_URL = "https://fg.test";

    const stagingAlert = {
      ...mockAlert,
      labels: { ...mockAlert.labels, namespace: "staging", environment: "staging" },
      fingerprint: "fp-staging",
    };
    const stagingPayload = {
      ...mockPayload,
      alerts: [stagingAlert],
      commonLabels: { namespace: "staging" },
    };
    const result = await evaluateAlertRollback(stagingAlert, stagingPayload);
    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("Environment");
  });

  it('returns action "dry-run" when dry-run mode is enabled', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = "true";
    process.env.FORGEGRAPH_ROLLBACK_DRY_RUN = "true";
    process.env.PROMETHEUS_BEARER_TOKEN = "tok";
    process.env.FORGEGRAPH_API_URL = "https://fg.test";

    const result = await evaluateAlertRollback(mockAlert, mockPayload);
    expect(result.action).toBe("dry-run");
  });

  it('returns action "disabled" when enabled=true but no token', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = "true";
    // no token env vars → safety disable

    const result = await evaluateAlertRollback(mockAlert, mockPayload);
    expect(result.action).toBe("disabled");
  });

  it("dedupes a second call with same alert within window", async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = "true";
    process.env.FORGEGRAPH_ROLLBACK_DRY_RUN = "true";
    process.env.PROMETHEUS_BEARER_TOKEN = "tok";
    process.env.FORGEGRAPH_API_URL = "https://fg.test";

    const first = await evaluateAlertRollback(mockAlert, mockPayload);
    expect(first.action).toBe("dry-run");

    const second = await evaluateAlertRollback(mockAlert, mockPayload);
    expect(second.action).toBe("deduped");
  });

  it("batch: first alert gets action, second is deduped", async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = "true";
    process.env.FORGEGRAPH_ROLLBACK_DRY_RUN = "true";
    process.env.PROMETHEUS_BEARER_TOKEN = "tok";
    process.env.FORGEGRAPH_API_URL = "https://fg.test";

    const secondAlert = { ...mockAlert, fingerprint: "fp-2" };
    const twoAlerts = [mockAlert, secondAlert];
    const batchPayload = { ...mockPayload, alerts: twoAlerts };

    const results = await evaluateBatchRollback(twoAlerts, batchPayload);
    expect(results).toHaveLength(2);
    expect(results[0]!.action).toBe("dry-run");
    expect(results[1]!.action).toBe("deduped");
  });
});
