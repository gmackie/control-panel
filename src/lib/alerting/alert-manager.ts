import { z } from 'zod';

// Alert severity levels
export const AlertSeverity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type AlertSeverity = z.infer<typeof AlertSeverity>;

// Alert status
export const AlertStatus = z.enum(['active', 'resolved', 'acknowledged', 'suppressed']);
export type AlertStatus = z.infer<typeof AlertStatus>;

// Notification channel types
export const NotificationChannelType = z.enum(['email', 'slack', 'pagerduty', 'webhook', 'sms', 'teams']);
export type NotificationChannelType = z.infer<typeof NotificationChannelType>;

// Alert schema
export const AlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: AlertSeverity,
  status: AlertStatus,
  source: z.string(), // application, infrastructure, security, etc.
  namespace: z.string().optional(),
  application: z.string().optional(),
  pod: z.string().optional(),
  timestamp: z.date(),
  resolvedAt: z.date().optional(),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.date().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
  runbook: z.string().optional(),
  dashboardUrl: z.string().optional(),
});

export type Alert = z.infer<typeof AlertSchema>;

// Notification channel schema
export const NotificationChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: NotificationChannelType,
  enabled: z.boolean().default(true),
  config: z.record(z.any()),
  filters: z.object({
    severities: z.array(AlertSeverity).optional(),
    sources: z.array(z.string()).optional(),
    namespaces: z.array(z.string()).optional(),
    applications: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  escalation: z.object({
    delay: z.number().default(300), // 5 minutes
    maxRetries: z.number().default(3),
    backoffMultiplier: z.number().default(2),
  }).optional(),
});

export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

// Alert rule schema
export const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean().default(true),
  query: z.string(), // Prometheus query
  condition: z.string(), // Comparison operator and value
  duration: z.string().default('5m'), // How long condition must be true
  severity: AlertSeverity,
  labels: z.record(z.string()).default({}),
  annotations: z.record(z.string()).default({}),
  runbook: z.string().optional(),
  silenceFilters: z.array(z.string()).default([]),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;

export class AlertManager {
  private alerts = new Map<string, Alert>();
  private channels = new Map<string, NotificationChannel>();
  private rules = new Map<string, AlertRule>();
  private silences = new Map<string, { until: Date; filters: string[] }>();

  // Alert management
  async createAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.alerts.set(newAlert.id, newAlert);
    await this.processAlert(newAlert);
    return newAlert;
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert | null> {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    const updatedAlert = { ...alert, ...updates };
    this.alerts.set(id, updatedAlert);
    
    if (updates.status === 'resolved' && !updatedAlert.resolvedAt) {
      updatedAlert.resolvedAt = new Date();
    }

    await this.processAlert(updatedAlert);
    return updatedAlert;
  }

  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<Alert | null> {
    return this.updateAlert(id, {
      status: 'acknowledged',
      acknowledgedBy,
      acknowledgedAt: new Date(),
    });
  }

  async resolveAlert(id: string): Promise<Alert | null> {
    return this.updateAlert(id, {
      status: 'resolved',
      resolvedAt: new Date(),
    });
  }

  getAlert(id: string): Alert | null {
    return this.alerts.get(id) || null;
  }

  getAlerts(filters?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    source?: string;
    namespace?: string;
    application?: string;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      alerts = alerts.filter(alert => {
        if (filters.status && alert.status !== filters.status) return false;
        if (filters.severity && alert.severity !== filters.severity) return false;
        if (filters.source && alert.source !== filters.source) return false;
        if (filters.namespace && alert.namespace !== filters.namespace) return false;
        if (filters.application && alert.application !== filters.application) return false;
        return true;
      });
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Notification channel management
  addNotificationChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  removeNotificationChannel(id: string): boolean {
    return this.channels.delete(id);
  }

  getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  // Alert rule management
  addAlertRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeAlertRule(id: string): boolean {
    return this.rules.delete(id);
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  // Silence management
  createSilence(filters: string[], duration: number): string {
    const silenceId = `silence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const until = new Date(Date.now() + duration * 1000);
    
    this.silences.set(silenceId, { until, filters });
    return silenceId;
  }

  removeSilence(id: string): boolean {
    return this.silences.delete(id);
  }

  // Internal alert processing
  private async processAlert(alert: Alert): Promise<void> {
    // Check if alert should be silenced
    if (this.isAlertSilenced(alert)) {
      return;
    }

    // Find matching notification channels
    const matchingChannels = this.getMatchingChannels(alert);

    // Send notifications
    for (const channel of matchingChannels) {
      if (channel.enabled) {
        await this.sendNotification(channel, alert);
      }
    }
  }

  private isAlertSilenced(alert: Alert): boolean {
    const now = new Date();
    
    for (const [_, silence] of this.silences) {
      if (silence.until > now) {
        // Check if any silence filters match the alert
        const matches = silence.filters.some(filter => {
          return (
            alert.source.includes(filter) ||
            alert.namespace?.includes(filter) ||
            alert.application?.includes(filter) ||
            alert.tags.some(tag => tag.includes(filter))
          );
        });
        if (matches) return true;
      }
    }
    
    return false;
  }

  private getMatchingChannels(alert: Alert): NotificationChannel[] {
    return Array.from(this.channels.values()).filter(channel => {
      if (!channel.filters) return true;

      const { severities, sources, namespaces, applications, tags } = channel.filters;

      if (severities && !severities.includes(alert.severity)) return false;
      if (sources && !sources.includes(alert.source)) return false;
      if (namespaces && alert.namespace && !namespaces.includes(alert.namespace)) return false;
      if (applications && alert.application && !applications.includes(alert.application)) return false;
      if (tags && !tags.some(tag => alert.tags.includes(tag))) return false;

      return true;
    });
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel, alert);
          break;
        case 'slack':
          await this.sendSlackNotification(channel, alert);
          break;
        case 'pagerduty':
          await this.sendPagerDutyNotification(channel, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert);
          break;
        case 'sms':
          await this.sendSMSNotification(channel, alert);
          break;
        case 'teams':
          await this.sendTeamsNotification(channel, alert);
          break;
      }
    } catch (error) {
      console.error(`Failed to send notification via ${channel.type}:`, error);
      
      // Implement retry logic with exponential backoff
      if (channel.escalation) {
        setTimeout(() => {
          this.sendNotification(channel, alert);
        }, channel.escalation.delay * 1000);
      }
    }
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const { to, subject, template } = channel.config;
    
    // Use SendGrid or other email service
    const emailContent = this.formatEmailNotification(alert, template);
    
    // Implementation would use actual email service
    console.log(`Sending email notification to ${to}: ${alert.title}`);
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const { webhookUrl, channel: slackChannel } = channel.config;
    
    const payload = {
      channel: slackChannel,
      text: `🚨 Alert: ${alert.title}`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        title: alert.title,
        text: alert.description,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Application', value: alert.application || 'N/A', short: true },
          { title: 'Namespace', value: alert.namespace || 'N/A', short: true },
        ],
        actions: alert.dashboardUrl ? [{
          type: 'button',
          text: 'View Dashboard',
          url: alert.dashboardUrl,
        }] : [],
        ts: Math.floor(alert.timestamp.getTime() / 1000),
      }],
    };

    // Implementation would make actual HTTP request
    console.log(`Sending Slack notification: ${alert.title}`);
  }

  private async sendPagerDutyNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const { integrationKey } = channel.config;
    
    const payload = {
      routing_key: integrationKey,
      event_action: alert.status === 'resolved' ? 'resolve' : 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.title,
        severity: alert.severity,
        source: alert.source,
        component: alert.application,
        group: alert.namespace,
        custom_details: alert.metadata,
      },
    };

    // Implementation would make actual HTTP request to PagerDuty
    console.log(`Sending PagerDuty notification: ${alert.title}`);
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const { url, method = 'POST', headers = {} } = channel.config;
    
    const payload = {
      alert,
      timestamp: new Date().toISOString(),
    };

    // Implementation would make actual HTTP request
    console.log(`Sending webhook notification to ${url}: ${alert.title}`);
  }

  private async sendSMSNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const { phoneNumber, message } = channel.config;
    
    const smsText = message || `Alert: ${alert.title} - ${alert.severity.toUpperCase()}`;
    
    // Implementation would use Twilio or other SMS service
    console.log(`Sending SMS to ${phoneNumber}: ${alert.title}`);
  }

  private async sendTeamsNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const { webhookUrl } = channel.config;
    
    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getSeverityColor(alert.severity).replace('#', ''),
      summary: alert.title,
      sections: [{
        activityTitle: `🚨 ${alert.title}`,
        activitySubtitle: alert.description,
        facts: [
          { name: 'Severity', value: alert.severity.toUpperCase() },
          { name: 'Source', value: alert.source },
          { name: 'Application', value: alert.application || 'N/A' },
          { name: 'Namespace', value: alert.namespace || 'N/A' },
          { name: 'Timestamp', value: alert.timestamp.toISOString() },
        ],
      }],
      potentialAction: alert.dashboardUrl ? [{
        '@type': 'OpenUri',
        name: 'View Dashboard',
        targets: [{ os: 'default', uri: alert.dashboardUrl }],
      }] : [],
    };

    // Implementation would make actual HTTP request
    console.log(`Sending Teams notification: ${alert.title}`);
  }

  private getSeverityColor(severity: AlertSeverity): string {
    const colors = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFAA00',
      low: '#FFFF00',
      info: '#0066FF',
    };
    return colors[severity];
  }

  private formatEmailNotification(alert: Alert, template?: string): string {
    if (template) {
      return template
        .replace('{{title}}', alert.title)
        .replace('{{description}}', alert.description)
        .replace('{{severity}}', alert.severity)
        .replace('{{source}}', alert.source)
        .replace('{{application}}', alert.application || 'N/A')
        .replace('{{namespace}}', alert.namespace || 'N/A');
    }

    return `
Alert: ${alert.title}

Description: ${alert.description}
Severity: ${alert.severity.toUpperCase()}
Source: ${alert.source}
Application: ${alert.application || 'N/A'}
Namespace: ${alert.namespace || 'N/A'}
Timestamp: ${alert.timestamp.toISOString()}

${alert.dashboardUrl ? `Dashboard: ${alert.dashboardUrl}` : ''}
${alert.runbook ? `Runbook: ${alert.runbook}` : ''}
    `.trim();
  }

  // Utility methods
  getAlertStatistics() {
    const alerts = Array.from(this.alerts.values());
    
    return {
      total: alerts.length,
      byStatus: {
        active: alerts.filter(a => a.status === 'active').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        suppressed: alerts.filter(a => a.status === 'suppressed').length,
      },
      bySeverity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        info: alerts.filter(a => a.severity === 'info').length,
      },
      bySource: alerts.reduce((acc, alert) => {
        acc[alert.source] = (acc[alert.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Singleton instance
export const alertManager = new AlertManager();