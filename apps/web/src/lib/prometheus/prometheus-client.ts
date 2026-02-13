/**
 * Prometheus Rule Management Client
 *
 * Manages PrometheusRule custom resources (CRDs) in the monitoring namespace
 * via the Kubernetes API.
 */

import { getK8sClient } from '@/lib/cluster/k8s-api-client';

// Kubernetes resource names: lowercase alphanumeric, hyphens, dots; max 253 chars
const K8S_NAME_RE = /^[a-z0-9][a-z0-9.\-]{0,251}[a-z0-9]$/;

function validateK8sName(name: string): void {
  if (!K8S_NAME_RE.test(name)) {
    throw new Error(`Invalid Kubernetes resource name: ${name}`);
  }
}

export interface PrometheusRuleGroup {
  name: string;
  interval?: string;
  rules: PrometheusAlertRule[];
}

export interface PrometheusAlertRule {
  alert: string;
  expr: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PrometheusRuleResource {
  apiVersion: 'monitoring.coreos.com/v1';
  kind: 'PrometheusRule';
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    groups: PrometheusRuleGroup[];
  };
}

interface PrometheusRuleList {
  apiVersion: string;
  kind: string;
  items: PrometheusRuleResource[];
}

export class PrometheusRuleClient {
  private namespace: string;
  private basePath: string;

  constructor(namespace: string = 'monitoring') {
    this.namespace = namespace;
    this.basePath = `/apis/monitoring.coreos.com/v1/namespaces/${this.namespace}/prometheusrules`;
  }

  /**
   * List all PrometheusRule resources in the monitoring namespace
   */
  async listRules(): Promise<PrometheusRuleResource[]> {
    const client = getK8sClient();
    if (!client) {
      throw new Error('K8s client not available - K3S_SA_TOKEN not configured');
    }

    const result = await client.request<PrometheusRuleList>(this.basePath);
    return result.items;
  }

  /**
   * Get a specific PrometheusRule by name
   */
  async getRule(name: string): Promise<PrometheusRuleResource> {
    validateK8sName(name);
    const client = getK8sClient();
    if (!client) {
      throw new Error('K8s client not available - K3S_SA_TOKEN not configured');
    }

    return client.request<PrometheusRuleResource>(`${this.basePath}/${name}`);
  }

  /**
   * Create a new PrometheusRule resource
   */
  async createRule(rule: PrometheusRuleResource): Promise<PrometheusRuleResource> {
    const client = getK8sClient();
    if (!client) {
      throw new Error('K8s client not available - K3S_SA_TOKEN not configured');
    }

    // Ensure required fields
    const resource: PrometheusRuleResource = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: {
        ...rule.metadata,
        namespace: this.namespace,
      },
      spec: rule.spec,
    };

    return client.request<PrometheusRuleResource>(this.basePath, {
      method: 'POST',
      body: JSON.stringify(resource),
    });
  }

  /**
   * Update an existing PrometheusRule resource
   */
  async updateRule(name: string, rule: PrometheusRuleResource): Promise<PrometheusRuleResource> {
    validateK8sName(name);
    const client = getK8sClient();
    if (!client) {
      throw new Error('K8s client not available - K3S_SA_TOKEN not configured');
    }

    // Ensure required fields
    const resource: PrometheusRuleResource = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: {
        ...rule.metadata,
        name,
        namespace: this.namespace,
      },
      spec: rule.spec,
    };

    return client.request<PrometheusRuleResource>(`${this.basePath}/${name}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    });
  }

  /**
   * Delete a PrometheusRule resource
   */
  async deleteRule(name: string): Promise<void> {
    validateK8sName(name);
    const client = getK8sClient();
    if (!client) {
      throw new Error('K8s client not available - K3S_SA_TOKEN not configured');
    }

    await client.request(`${this.basePath}/${name}`, {
      method: 'DELETE',
    });
  }
}

export const prometheusRuleClient = new PrometheusRuleClient();
