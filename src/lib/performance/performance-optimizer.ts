import { z } from 'zod';

// Performance monitoring schemas
export const MetricType = z.enum([
  'cpu', 'memory', 'disk', 'network', 'response_time', 
  'throughput', 'error_rate', 'availability', 'latency'
]);
export type MetricType = z.infer<typeof MetricType>;

export const OptimizationAction = z.enum([
  'scale_up', 'scale_down', 'scale_out', 'scale_in', 
  'tune_params', 'cache_optimize', 'db_optimize', 
  'resource_reallocation', 'traffic_routing'
]);
export type OptimizationAction = z.infer<typeof OptimizationAction>;

export const AutoScalingTrigger = z.enum(['metric_threshold', 'schedule', 'predictive', 'manual']);
export type AutoScalingTrigger = z.infer<typeof AutoScalingTrigger>;

// Performance metric schema
export const PerformanceMetricSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  source: z.object({
    type: z.enum(['application', 'infrastructure', 'database', 'cache', 'cdn']),
    identifier: z.string(),
    environment: z.string().optional(),
    namespace: z.string().optional(),
  }),
  metrics: z.record(z.object({
    value: z.number(),
    unit: z.string(),
    threshold: z.object({
      warning: z.number().optional(),
      critical: z.number().optional(),
    }).optional(),
  })),
  metadata: z.record(z.any()).default({}),
});

export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;

// Auto-scaling rule schema
export const AutoScalingRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean().default(true),
  target: z.object({
    type: z.enum(['deployment', 'statefulset', 'function', 'database']),
    identifier: z.string(),
    namespace: z.string(),
    environment: z.string(),
  }),
  trigger: AutoScalingTrigger,
  conditions: z.array(z.object({
    metric: MetricType,
    operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
    threshold: z.number(),
    duration: z.number(), // seconds
  })),
  actions: z.array(z.object({
    type: OptimizationAction,
    parameters: z.record(z.any()),
    cooldown: z.number().default(300), // 5 minutes
    maxRetries: z.number().default(3),
  })),
  constraints: z.object({
    minReplicas: z.number().default(1),
    maxReplicas: z.number().default(10),
    minCpu: z.string().optional(),
    maxCpu: z.string().optional(),
    minMemory: z.string().optional(),
    maxMemory: z.string().optional(),
  }),
  schedule: z.object({
    timezone: z.string().default('UTC'),
    rules: z.array(z.object({
      dayOfWeek: z.string(), // cron format
      timeRange: z.object({
        start: z.string(), // HH:mm
        end: z.string(), // HH:mm
      }),
      scalingFactor: z.number().default(1),
    })).optional(),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastTriggered: z.date().optional(),
});

export type AutoScalingRule = z.infer<typeof AutoScalingRuleSchema>;

// Performance optimization recommendation schema
export const OptimizationRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum([
    'resource_allocation', 'scaling', 'caching', 'database', 
    'network', 'application_code', 'infrastructure'
  ]),
  action: OptimizationAction,
  target: z.object({
    type: z.string(),
    identifier: z.string(),
    environment: z.string(),
  }),
  impact: z.object({
    performance: z.number(), // percentage improvement
    cost: z.number(), // cost impact (positive = savings, negative = cost increase)
    effort: z.enum(['low', 'medium', 'high']),
    risk: z.enum(['low', 'medium', 'high']),
  }),
  implementation: z.object({
    automated: z.boolean(),
    steps: z.array(z.string()),
    estimatedTime: z.number(), // minutes
    dependencies: z.array(z.string()).default([]),
  }),
  metrics: z.object({
    baseline: z.record(z.number()),
    projected: z.record(z.number()),
    confidence: z.number().min(0).max(100),
  }),
  status: z.enum(['pending', 'approved', 'implementing', 'completed', 'dismissed']).default('pending'),
  createdAt: z.date(),
  implementedAt: z.date().optional(),
  results: z.object({
    actualImprovement: z.record(z.number()).optional(),
    costImpact: z.number().optional(),
    notes: z.string().optional(),
  }).optional(),
});

export type OptimizationRecommendation = z.infer<typeof OptimizationRecommendationSchema>;

// Auto-scaling event schema
export const AutoScalingEventSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  ruleId: z.string(),
  trigger: AutoScalingTrigger,
  action: OptimizationAction,
  target: z.object({
    type: z.string(),
    identifier: z.string(),
    namespace: z.string(),
  }),
  conditions: z.array(z.object({
    metric: z.string(),
    currentValue: z.number(),
    threshold: z.number(),
    satisfied: z.boolean(),
  })),
  changes: z.object({
    before: z.record(z.any()),
    after: z.record(z.any()),
  }),
  status: z.enum(['pending', 'executing', 'completed', 'failed']),
  duration: z.number().optional(),
  error: z.string().optional(),
});

export type AutoScalingEvent = z.infer<typeof AutoScalingEventSchema>;

export class PerformanceOptimizer {
  private metrics = new Map<string, PerformanceMetric[]>();
  private rules = new Map<string, AutoScalingRule>();
  private recommendations = new Map<string, OptimizationRecommendation>();
  private events = new Map<string, AutoScalingEvent>();
  private activeOptimizations = new Set<string>();

  // Metric collection and analysis
  async collectMetrics(source: string): Promise<PerformanceMetric> {
    const metric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      source: {
        type: 'application',
        identifier: source,
        environment: 'production',
        namespace: 'default',
      },
      metrics: await this.gatherMetrics(source),
      metadata: {},
    };

    if (!this.metrics.has(source)) {
      this.metrics.set(source, []);
    }
    
    const sourceMetrics = this.metrics.get(source)!;
    sourceMetrics.push(metric);
    
    // Keep only last 1000 metrics per source
    if (sourceMetrics.length > 1000) {
      sourceMetrics.splice(0, sourceMetrics.length - 1000);
    }

    // Analyze metrics for optimization opportunities
    await this.analyzeMetrics(source, metric);
    
    // Check auto-scaling rules
    await this.evaluateAutoScalingRules(source, metric);

    return metric;
  }

  private async gatherMetrics(source: string): Promise<Record<string, any>> {
    // Simulate metric gathering with realistic values
    const now = Date.now();
    const timeOfDay = new Date().getHours();
    
    // Simulate daily patterns
    const baseLoad = 0.3 + (Math.sin((timeOfDay - 6) * Math.PI / 12) + 1) * 0.3; // Peak at 6 PM
    const noise = (Math.random() - 0.5) * 0.2;
    const load = Math.max(0.1, Math.min(0.95, baseLoad + noise));

    return {
      cpu: {
        value: Math.round(load * 100 * 100) / 100,
        unit: 'percent',
        threshold: { warning: 70, critical: 90 },
      },
      memory: {
        value: Math.round((load * 0.8 + 0.1) * 100 * 100) / 100,
        unit: 'percent',
        threshold: { warning: 80, critical: 95 },
      },
      response_time: {
        value: Math.round((50 + load * 200 + Math.random() * 50) * 10) / 10,
        unit: 'ms',
        threshold: { warning: 200, critical: 500 },
      },
      throughput: {
        value: Math.round((1000 + load * 2000) * 10) / 10,
        unit: 'requests/min',
        threshold: { warning: 500, critical: 100 },
      },
      error_rate: {
        value: Math.round((Math.random() * 2 + load * 3) * 100) / 100,
        unit: 'percent',
        threshold: { warning: 2, critical: 5 },
      },
      availability: {
        value: Math.round((99.9 - Math.random() * 0.5) * 100) / 100,
        unit: 'percent',
        threshold: { warning: 99.5, critical: 99.0 },
      },
    };
  }

  private async analyzeMetrics(source: string, metric: PerformanceMetric): Promise<void> {
    const sourceMetrics = this.metrics.get(source) || [];
    
    if (sourceMetrics.length < 10) return; // Need enough data points

    // Analyze trends and generate recommendations
    const recentMetrics = sourceMetrics.slice(-10);
    const trends = this.calculateTrends(recentMetrics);
    
    for (const [metricName, trend] of Object.entries(trends)) {
      if (Math.abs(trend.slope) > 0.1) { // Significant trend
        await this.generateOptimizationRecommendation(source, metricName, trend, metric);
      }
    }
  }

  private calculateTrends(metrics: PerformanceMetric[]): Record<string, any> {
    const trends: Record<string, any> = {};
    
    if (metrics.length < 2) return trends;

    const metricNames = Object.keys(metrics[0].metrics);
    
    for (const metricName of metricNames) {
      const values = metrics.map(m => m.metrics[metricName]?.value || 0);
      const timestamps = metrics.map(m => m.timestamp.getTime());
      
      // Simple linear regression
      const n = values.length;
      const sumX = timestamps.reduce((a, b) => a + b, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
      const sumX2 = timestamps.reduce((sum, x) => sum + x * x, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      trends[metricName] = {
        slope: slope * 1000000, // Scale for readability
        intercept,
        direction: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
        recent: values[values.length - 1],
        average: sumY / n,
      };
    }
    
    return trends;
  }

  private async generateOptimizationRecommendation(
    source: string, 
    metricName: string, 
    trend: any, 
    currentMetric: PerformanceMetric
  ): Promise<void> {
    const currentValue = currentMetric.metrics[metricName]?.value || 0;
    const threshold = currentMetric.metrics[metricName]?.threshold;
    
    // Skip if no threshold defined or not approaching it
    if (!threshold || (currentValue < threshold.warning! * 0.8)) return;

    let recommendation: Partial<OptimizationRecommendation> = {
      title: '',
      description: '',
      priority: 'medium',
      category: 'resource_allocation',
      target: {
        type: currentMetric.source.type,
        identifier: currentMetric.source.identifier,
        environment: currentMetric.source.environment || 'production',
      },
    };

    switch (metricName) {
      case 'cpu':
        if (trend.direction === 'increasing' && currentValue > 70) {
          recommendation = {
            ...recommendation,
            title: 'High CPU Usage Detected',
            description: `CPU usage is trending upward (${currentValue}%) and approaching critical thresholds. Consider scaling resources.`,
            priority: currentValue > 85 ? 'critical' : 'high',
            action: 'scale_up',
            impact: {
              performance: 30,
              cost: -20,
              effort: 'low',
              risk: 'low',
            },
            implementation: {
              automated: true,
              steps: [
                'Increase CPU allocation or add replicas',
                'Monitor performance improvement',
                'Adjust scaling policies if needed'
              ],
              estimatedTime: 15,
              dependencies: [],
            },
          };
        }
        break;

      case 'memory':
        if (trend.direction === 'increasing' && currentValue > 75) {
          recommendation = {
            ...recommendation,
            title: 'Memory Usage Approaching Limits',
            description: `Memory usage is ${currentValue}% and increasing. Risk of OOM events.`,
            priority: currentValue > 90 ? 'critical' : 'high',
            action: 'scale_up',
            category: 'resource_allocation',
            impact: {
              performance: 25,
              cost: -15,
              effort: 'low',
              risk: 'medium',
            },
          };
        }
        break;

      case 'response_time':
        if (trend.direction === 'increasing' && currentValue > 200) {
          recommendation = {
            ...recommendation,
            title: 'Response Time Degradation',
            description: `Response times are increasing (${currentValue}ms). Consider caching or scaling optimizations.`,
            priority: currentValue > 500 ? 'critical' : 'high',
            action: 'cache_optimize',
            category: 'caching',
            impact: {
              performance: 40,
              cost: -5,
              effort: 'medium',
              risk: 'low',
            },
          };
        }
        break;

      case 'error_rate':
        if (trend.direction === 'increasing' && currentValue > 2) {
          recommendation = {
            ...recommendation,
            title: 'Increasing Error Rate',
            description: `Error rate is ${currentValue}% and trending upward. Investigate application health.`,
            priority: 'critical',
            action: 'tune_params',
            category: 'application_code',
            impact: {
              performance: 50,
              cost: 0,
              effort: 'high',
              risk: 'medium',
            },
          };
        }
        break;
    }

    if (recommendation.title) {
      const rec: OptimizationRecommendation = {
        ...recommendation,
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metrics: {
          baseline: { [metricName]: trend.average },
          projected: { [metricName]: trend.average * 0.8 }, // Assume 20% improvement
          confidence: 75,
        },
        createdAt: new Date(),
      } as OptimizationRecommendation;

      this.recommendations.set(rec.id, rec);
    }
  }

  // Auto-scaling rule management
  createAutoScalingRule(rule: Omit<AutoScalingRule, 'id' | 'createdAt' | 'updatedAt'>): AutoScalingRule {
    const newRule: AutoScalingRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  private async evaluateAutoScalingRules(source: string, metric: PerformanceMetric): Promise<void> {
    const relevantRules = Array.from(this.rules.values()).filter(rule => 
      rule.enabled && 
      rule.target.identifier === source &&
      rule.trigger === 'metric_threshold'
    );

    for (const rule of relevantRules) {
      const shouldTrigger = await this.evaluateRuleConditions(rule, metric);
      
      if (shouldTrigger) {
        await this.executeAutoScalingActions(rule, metric);
      }
    }
  }

  private async evaluateRuleConditions(rule: AutoScalingRule, metric: PerformanceMetric): Promise<boolean> {
    // Check cooldown period
    if (rule.lastTriggered) {
      const cooldownMs = Math.min(...rule.actions.map(a => a.cooldown)) * 1000;
      if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) {
        return false;
      }
    }

    // Evaluate all conditions
    const conditionResults = rule.conditions.map(condition => {
      const metricValue = metric.metrics[condition.metric]?.value || 0;
      
      switch (condition.operator) {
        case '>': return metricValue > condition.threshold;
        case '<': return metricValue < condition.threshold;
        case '>=': return metricValue >= condition.threshold;
        case '<=': return metricValue <= condition.threshold;
        case '==': return metricValue === condition.threshold;
        case '!=': return metricValue !== condition.threshold;
        default: return false;
      }
    });

    // All conditions must be satisfied
    return conditionResults.every(result => result);
  }

  private async executeAutoScalingActions(rule: AutoScalingRule, metric: PerformanceMetric): Promise<void> {
    const event: AutoScalingEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ruleId: rule.id,
      trigger: rule.trigger,
      action: rule.actions[0].type, // Use first action for simplicity
      target: rule.target,
      conditions: rule.conditions.map(condition => ({
        metric: condition.metric,
        currentValue: metric.metrics[condition.metric]?.value || 0,
        threshold: condition.threshold,
        satisfied: true,
      })),
      changes: {
        before: {},
        after: {},
      },
      status: 'executing',
    };

    this.events.set(event.id, event);
    
    try {
      // Execute scaling actions
      for (const action of rule.actions) {
        await this.executeOptimizationAction(action.type, rule.target, action.parameters);
      }
      
      event.status = 'completed';
      event.duration = Date.now() - event.timestamp.getTime();
      
      // Update rule last triggered time
      rule.lastTriggered = new Date();
      
    } catch (error) {
      event.status = 'failed';
      event.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private async executeOptimizationAction(
    action: OptimizationAction,
    target: any,
    parameters: Record<string, any>
  ): Promise<void> {
    // Simulate action execution
    console.log(`Executing ${action} on ${target.identifier} with parameters:`, parameters);
    
    switch (action) {
      case 'scale_up':
        // Simulate scaling up resources
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      case 'scale_out':
        // Simulate scaling out (adding replicas)
        await new Promise(resolve => setTimeout(resolve, 3000));
        break;
      case 'cache_optimize':
        // Simulate cache optimization
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;
      default:
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Recommendation management
  async implementRecommendation(recommendationId: string, implementedBy: string): Promise<boolean> {
    const recommendation = this.recommendations.get(recommendationId);
    if (!recommendation || recommendation.status !== 'pending') {
      return false;
    }

    recommendation.status = 'implementing';
    
    try {
      // Execute the optimization
      await this.executeOptimizationAction(
        recommendation.action,
        recommendation.target,
        {}
      );
      
      recommendation.status = 'completed';
      recommendation.implementedAt = new Date();
      
      // Simulate results
      recommendation.results = {
        actualImprovement: Object.fromEntries(
          Object.entries(recommendation.metrics.projected).map(([key, value]) => [
            key, 
            value * (0.8 + Math.random() * 0.4) // Some variance from projection
          ])
        ),
        costImpact: recommendation.impact.cost * (0.9 + Math.random() * 0.2),
        notes: `Successfully implemented by ${implementedBy}`,
      };
      
      return true;
    } catch (error) {
      recommendation.status = 'pending';
      return false;
    }
  }

  // Getters
  getMetrics(source: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(source) || [];
    return metrics.slice(-limit).reverse();
  }

  getAutoScalingRules(filters?: { enabled?: boolean; target?: string }): AutoScalingRule[] {
    let rules = Array.from(this.rules.values());
    
    if (filters) {
      if (filters.enabled !== undefined) {
        rules = rules.filter(r => r.enabled === filters.enabled);
      }
      if (filters.target) {
        rules = rules.filter(r => r.target.identifier.includes(filters.target!));
      }
    }
    
    return rules.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getOptimizationRecommendations(filters?: {
    priority?: string;
    status?: string;
    category?: string;
    limit?: number;
  }): OptimizationRecommendation[] {
    let recommendations = Array.from(this.recommendations.values());
    
    if (filters) {
      if (filters.priority) {
        recommendations = recommendations.filter(r => r.priority === filters.priority);
      }
      if (filters.status) {
        recommendations = recommendations.filter(r => r.status === filters.status);
      }
      if (filters.category) {
        recommendations = recommendations.filter(r => r.category === filters.category);
      }
    }
    
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    if (filters?.limit) {
      recommendations = recommendations.slice(0, filters.limit);
    }
    
    return recommendations;
  }

  getAutoScalingEvents(filters?: { ruleId?: string; status?: string; limit?: number }): AutoScalingEvent[] {
    let events = Array.from(this.events.values());
    
    if (filters) {
      if (filters.ruleId) {
        events = events.filter(e => e.ruleId === filters.ruleId);
      }
      if (filters.status) {
        events = events.filter(e => e.status === filters.status);
      }
    }
    
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }
    
    return events;
  }

  getPerformanceStatistics() {
    const allMetrics = Array.from(this.metrics.values()).flat();
    const rules = Array.from(this.rules.values());
    const recommendations = Array.from(this.recommendations.values());
    const events = Array.from(this.events.values());
    
    return {
      metrics: {
        total: allMetrics.length,
        sources: this.metrics.size,
        latest: allMetrics.length > 0 ? allMetrics[allMetrics.length - 1].timestamp : null,
      },
      autoScaling: {
        rules: {
          total: rules.length,
          enabled: rules.filter(r => r.enabled).length,
          byTrigger: Object.fromEntries(
            ['metric_threshold', 'schedule', 'predictive', 'manual']
              .map(trigger => [trigger, rules.filter(r => r.trigger === trigger).length])
          ),
        },
        events: {
          total: events.length,
          recent: events.filter(e => e.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000).length,
          byStatus: Object.fromEntries(
            ['pending', 'executing', 'completed', 'failed']
              .map(status => [status, events.filter(e => e.status === status).length])
          ),
        },
      },
      recommendations: {
        total: recommendations.length,
        pending: recommendations.filter(r => r.status === 'pending').length,
        implemented: recommendations.filter(r => r.status === 'completed').length,
        byPriority: Object.fromEntries(
          ['critical', 'high', 'medium', 'low']
            .map(priority => [priority, recommendations.filter(r => r.priority === priority).length])
        ),
        estimatedSavings: recommendations
          .filter(r => r.status === 'pending')
          .reduce((sum, r) => sum + (r.impact.cost > 0 ? r.impact.cost : 0), 0),
      },
    };
  }
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();