/**
 * AlertManager Configuration Client
 *
 * Reads and updates AlertManager configuration stored as a Kubernetes Secret.
 * The config is stored in the secret's `alertmanager.yaml` key as base64-encoded YAML.
 */

import { getK8sClient } from '@/lib/cluster/k8s-api-client';
import { parse, stringify } from 'yaml';

export interface AlertManagerConfig {
  global?: Record<string, unknown>;
  route: {
    receiver: string;
    group_by?: string[];
    group_wait?: string;
    group_interval?: string;
    repeat_interval?: string;
    routes?: AlertManagerRoute[];
  };
  receivers: AlertManagerReceiver[];
  inhibit_rules?: Array<Record<string, unknown>>;
}

export interface AlertManagerRoute {
  receiver: string;
  match?: Record<string, string>;
  match_re?: Record<string, string>;
  group_by?: string[];
  continue?: boolean;
  routes?: AlertManagerRoute[];
}

export interface AlertManagerReceiver {
  name: string;
  slack_configs?: Array<{
    api_url?: string;
    channel?: string;
    send_resolved?: boolean;
    title?: string;
    text?: string;
  }>;
  email_configs?: Array<{
    to: string;
    send_resolved?: boolean;
  }>;
  webhook_configs?: Array<{
    url: string;
    send_resolved?: boolean;
  }>;
  pagerduty_configs?: Array<{
    service_key?: string;
    routing_key?: string;
  }>;
}

export class AlertManagerClient {
  private namespace: string;
  private secretName: string;
  private alertmanagerUrl: string;

  constructor(
    namespace: string = 'monitoring',
    secretName: string = 'alertmanager-kube-prometheus-stack-alertmanager',
    alertmanagerUrl: string = 'http://alertmanager-kube-prometheus-stack-alertmanager.monitoring.svc.cluster.local:9093'
  ) {
    this.namespace = namespace;
    this.secretName = secretName;
    this.alertmanagerUrl = alertmanagerUrl;
  }

  /**
   * Get the current AlertManager configuration from the Kubernetes secret.
   * Decodes the base64-encoded alertmanager.yaml and parses it as YAML.
   */
  async getConfig(): Promise<AlertManagerConfig> {
    const client = getK8sClient();
    if (!client) {
      throw new Error('K8s client not available - K3S_SA_TOKEN not configured');
    }

    const secret = await client.request<{ data?: Record<string, string> }>(
      `/api/v1/namespaces/${this.namespace}/secrets/${this.secretName}`
    );

    if (!secret.data?.['alertmanager.yaml']) {
      throw new Error('alertmanager.yaml key not found in secret');
    }

    const yamlContent = Buffer.from(secret.data['alertmanager.yaml'], 'base64').toString('utf-8');
    const config = parse(yamlContent) as AlertManagerConfig;

    return config;
  }

  /**
   * Update the AlertManager configuration.
   * Stringifies to YAML, base64-encodes, and patches the Kubernetes secret.
   */
  async updateConfig(config: AlertManagerConfig): Promise<void> {
    const client = getK8sClient();
    if (!client) {
      throw new Error('K8s client not available - K3S_SA_TOKEN not configured');
    }

    const yamlContent = stringify(config);
    const encoded = Buffer.from(yamlContent, 'utf-8').toString('base64');

    await client.request(
      `/api/v1/namespaces/${this.namespace}/secrets/${this.secretName}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            'alertmanager.yaml': encoded,
          },
        }),
        headers: {
          'Content-Type': 'application/strategic-merge-patch+json',
        },
      }
    );
  }

  /**
   * Trigger an AlertManager configuration reload via its HTTP API.
   */
  async reload(): Promise<void> {
    const response = await fetch(`${this.alertmanagerUrl}/-/reload`, {
      method: 'POST',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AlertManager reload failed (${response.status}): ${text}`);
    }
  }
}

export const alertManagerClient = new AlertManagerClient();
