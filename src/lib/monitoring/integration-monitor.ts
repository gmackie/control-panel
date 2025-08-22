import { EventEmitter } from 'events';

export interface IntegrationStatus {
  provider: string;
  status: 'healthy' | 'degraded' | 'down' | 'checking';
  lastCheck: Date;
  responseTime: number;
  errorCount: number;
  successCount: number;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IntegrationMonitorConfig {
  provider: string;
  name: string;
  checkInterval: number; // milliseconds
  timeout: number; // milliseconds
  retryAttempts: number;
  healthCheck: () => Promise<HealthCheckResult>;
  onStatusChange?: (status: IntegrationStatus) => void;
  onIncident?: (incident: any) => void;
}

class IntegrationMonitor extends EventEmitter {
  private monitors: Map<string, NodeJS.Timeout> = new Map();
  private statuses: Map<string, IntegrationStatus> = new Map();
  private configs: Map<string, IntegrationMonitorConfig> = new Map();
  private incidentHistory: Map<string, any[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Register a new integration for monitoring
   */
  register(config: IntegrationMonitorConfig) {
    this.configs.set(config.provider, config);
    
    // Initialize status
    this.statuses.set(config.provider, {
      provider: config.provider,
      status: 'checking',
      lastCheck: new Date(),
      responseTime: 0,
      errorCount: 0,
      successCount: 0,
    });

    // Start monitoring
    this.startMonitoring(config.provider);

    // Perform initial health check
    this.performHealthCheck(config.provider);
  }

  /**
   * Unregister an integration from monitoring
   */
  unregister(provider: string) {
    const timer = this.monitors.get(provider);
    if (timer) {
      clearInterval(timer);
      this.monitors.delete(provider);
    }
    
    this.configs.delete(provider);
    this.statuses.delete(provider);
    this.incidentHistory.delete(provider);
  }

  /**
   * Start monitoring for a specific integration
   */
  private startMonitoring(provider: string) {
    const config = this.configs.get(provider);
    if (!config) return;

    // Clear existing timer if any
    const existingTimer = this.monitors.get(provider);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set up new monitoring interval
    const timer = setInterval(() => {
      this.performHealthCheck(provider);
    }, config.checkInterval);

    this.monitors.set(provider, timer);
  }

  /**
   * Perform a health check for a specific integration
   */
  async performHealthCheck(provider: string): Promise<void> {
    const config = this.configs.get(provider);
    if (!config) return;

    const currentStatus = this.statuses.get(provider);
    if (!currentStatus) return;

    try {
      // Update status to checking
      currentStatus.status = 'checking';
      this.emit('statusUpdate', currentStatus);

      // Perform the health check with timeout
      const startTime = Date.now();
      const result = await this.withTimeout(
        config.healthCheck(),
        config.timeout
      );

      const responseTime = Date.now() - startTime;

      // Update status based on result
      if (result.success) {
        currentStatus.status = 'healthy';
        currentStatus.successCount++;
        currentStatus.responseTime = responseTime;
        currentStatus.lastCheck = new Date();
        currentStatus.metadata = result.metadata;

        // Clear any active incidents
        this.resolveIncidents(provider);
      } else {
        currentStatus.errorCount++;
        
        // Determine if degraded or down
        const errorRate = currentStatus.errorCount / 
          (currentStatus.errorCount + currentStatus.successCount);
        
        if (errorRate > 0.5) {
          currentStatus.status = 'down';
          this.createIncident(provider, 'critical', result.error || 'Service is down');
        } else if (errorRate > 0.1) {
          currentStatus.status = 'degraded';
          this.createIncident(provider, 'medium', result.error || 'Service is degraded');
        }
      }

      // Notify about status change
      if (config.onStatusChange) {
        config.onStatusChange(currentStatus);
      }

      this.emit('healthCheck', {
        provider,
        status: currentStatus,
        result,
      });

    } catch (error: any) {
      currentStatus.status = 'down';
      currentStatus.errorCount++;
      currentStatus.lastCheck = new Date();
      
      this.createIncident(provider, 'critical', error.message || 'Health check failed');
      
      if (config.onStatusChange) {
        config.onStatusChange(currentStatus);
      }

      this.emit('error', {
        provider,
        error: error.message,
      });
    }

    this.statuses.set(provider, currentStatus);
  }

  /**
   * Create an incident for an integration
   */
  private createIncident(provider: string, severity: string, message: string) {
    const config = this.configs.get(provider);
    if (!config) return;

    const incident = {
      id: `${provider}-${Date.now()}`,
      provider,
      severity,
      message,
      timestamp: new Date(),
      resolved: false,
    };

    // Add to incident history
    const history = this.incidentHistory.get(provider) || [];
    history.push(incident);
    this.incidentHistory.set(provider, history);

    // Notify about the incident
    if (config.onIncident) {
      config.onIncident(incident);
    }

    this.emit('incident', incident);
  }

  /**
   * Resolve all active incidents for an integration
   */
  private resolveIncidents(provider: string) {
    const history = this.incidentHistory.get(provider) || [];
    
    history.forEach(incident => {
      if (!incident.resolved) {
        incident.resolved = true;
        incident.resolvedAt = new Date();
        
        this.emit('incidentResolved', incident);
      }
    });
  }

  /**
   * Helper to add timeout to promises
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Get current status for an integration
   */
  getStatus(provider: string): IntegrationStatus | undefined {
    return this.statuses.get(provider);
  }

  /**
   * Get all statuses
   */
  getAllStatuses(): IntegrationStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Get incident history for an integration
   */
  getIncidentHistory(provider: string): any[] {
    return this.incidentHistory.get(provider) || [];
  }

  /**
   * Force a health check for a specific integration
   */
  async checkNow(provider: string): Promise<void> {
    await this.performHealthCheck(provider);
  }

  /**
   * Check all registered integrations
   */
  async checkAll(): Promise<void> {
    const providers = Array.from(this.configs.keys());
    await Promise.all(providers.map(p => this.performHealthCheck(p)));
  }

  /**
   * Stop all monitoring
   */
  stopAll() {
    this.monitors.forEach(timer => clearInterval(timer));
    this.monitors.clear();
  }
}

// Create singleton instance
export const integrationMonitor = new IntegrationMonitor();

// Register default monitors
export function registerDefaultMonitors() {
  // Stripe Monitor
  integrationMonitor.register({
    provider: 'stripe',
    name: 'Stripe Payment Gateway',
    checkInterval: 60000, // 1 minute
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
    healthCheck: async () => {
      try {
        const response = await fetch('https://api.stripe.com/v1/charges?limit=1', {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY || ''}`,
          },
        });

        return {
          success: response.ok,
          responseTime: 0,
          metadata: {
            status: response.status,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          responseTime: 0,
          error: error.message,
        };
      }
    },
  });

  // SendGrid Monitor
  integrationMonitor.register({
    provider: 'sendgrid',
    name: 'SendGrid Email Service',
    checkInterval: 120000, // 2 minutes
    timeout: 10000,
    retryAttempts: 3,
    healthCheck: async () => {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY || ''}`,
          },
        });

        return {
          success: response.ok,
          responseTime: 0,
          metadata: {
            status: response.status,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          responseTime: 0,
          error: error.message,
        };
      }
    },
  });

  // Add more default monitors as needed
}

export default integrationMonitor;