import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performanceOptimizer, AutoScalingTrigger, MetricType, OptimizationAction } from '@/lib/performance/performance-optimizer';
import { z } from 'zod';

const CreateAutoScalingRuleSchema = z.object({
  name: z.string().min(1),
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
    duration: z.number().default(300), // 5 minutes
  })),
  actions: z.array(z.object({
    type: OptimizationAction,
    parameters: z.record(z.any()).default({}),
    cooldown: z.number().default(300),
    maxRetries: z.number().default(3),
  })),
  constraints: z.object({
    minReplicas: z.number().default(1),
    maxReplicas: z.number().default(10),
    minCpu: z.string().optional(),
    maxCpu: z.string().optional(),
    minMemory: z.string().optional(),
    maxMemory: z.string().optional(),
  }).default({}),
  schedule: z.object({
    timezone: z.string().default('UTC'),
    rules: z.array(z.object({
      dayOfWeek: z.string(),
      timeRange: z.object({
        start: z.string(),
        end: z.string(),
      }),
      scalingFactor: z.number().default(1),
    })).optional(),
  }).optional(),
});

// GET /api/performance/autoscaling - Get auto-scaling rules and events
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get('enabled');
    const target = searchParams.get('target');
    const includeEvents = searchParams.get('events') === 'true';
    const includeStats = searchParams.get('stats') === 'true';

    const rules = performanceOptimizer.getAutoScalingRules({
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      target: target || undefined,
    });

    const response: any = {
      success: true,
      rules,
      total: rules.length,
      lastUpdated: new Date().toISOString(),
    };

    if (includeEvents) {
      const events = performanceOptimizer.getAutoScalingEvents({ limit: 50 });
      response.events = events;
    }

    if (includeStats) {
      response.statistics = performanceOptimizer.getPerformanceStatistics().autoScaling;
    }

    // Initialize with sample rules if none exist
    if (rules.length === 0) {
      await initializeSampleAutoScalingRules();
      response.rules = performanceOptimizer.getAutoScalingRules();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching auto-scaling rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch auto-scaling rules' },
      { status: 500 }
    );
  }
}

// POST /api/performance/autoscaling - Create auto-scaling rule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const ruleData = CreateAutoScalingRuleSchema.parse(body);

    const rule = performanceOptimizer.createAutoScalingRule(ruleData);

    return NextResponse.json({
      success: true,
      rule,
      message: 'Auto-scaling rule created successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid rule configuration', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating auto-scaling rule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create auto-scaling rule' },
      { status: 500 }
    );
  }
}

// Initialize sample auto-scaling rules
async function initializeSampleAutoScalingRules() {
  try {
    // CPU-based scaling rule
    performanceOptimizer.createAutoScalingRule({
      name: 'Control Panel CPU Auto-scaling',
      description: 'Scale control panel deployment based on CPU usage',
      enabled: true,
      target: {
        type: 'deployment',
        identifier: 'control-panel',
        namespace: 'control-panel',
        environment: 'production',
      },
      trigger: 'metric_threshold',
      conditions: [
        {
          metric: 'cpu',
          operator: '>',
          threshold: 70,
          duration: 300, // 5 minutes
        }
      ],
      actions: [
        {
          type: 'scale_out',
          parameters: {
            incrementReplicas: 1,
            maxIncrease: 3,
          },
          cooldown: 300,
          maxRetries: 3,
        }
      ],
      constraints: {
        minReplicas: 2,
        maxReplicas: 10,
        minCpu: '100m',
        maxCpu: '2000m',
        minMemory: '256Mi',
        maxMemory: '4Gi',
      },
    });

    // Memory-based scaling rule
    performanceOptimizer.createAutoScalingRule({
      name: 'Database Memory Management',
      description: 'Scale database resources based on memory pressure',
      enabled: true,
      target: {
        type: 'statefulset',
        identifier: 'postgresql',
        namespace: 'database',
        environment: 'production',
      },
      trigger: 'metric_threshold',
      conditions: [
        {
          metric: 'memory',
          operator: '>',
          threshold: 85,
          duration: 600, // 10 minutes
        }
      ],
      actions: [
        {
          type: 'scale_up',
          parameters: {
            memoryIncrement: '1Gi',
            cpuIncrement: '500m',
          },
          cooldown: 1800, // 30 minutes
          maxRetries: 2,
        }
      ],
      constraints: {
        minReplicas: 1,
        maxReplicas: 3,
        minMemory: '2Gi',
        maxMemory: '16Gi',
      },
    });

    // Response time-based scaling
    performanceOptimizer.createAutoScalingRule({
      name: 'API Response Time Scaling',
      description: 'Scale API gateway based on response time degradation',
      enabled: true,
      target: {
        type: 'deployment',
        identifier: 'api-gateway',
        namespace: 'gateway',
        environment: 'production',
      },
      trigger: 'metric_threshold',
      conditions: [
        {
          metric: 'response_time',
          operator: '>',
          threshold: 500, // 500ms
          duration: 180, // 3 minutes
        }
      ],
      actions: [
        {
          type: 'scale_out',
          parameters: {
            incrementReplicas: 2,
          },
          cooldown: 600, // 10 minutes
          maxRetries: 3,
        }
      ],
      constraints: {
        minReplicas: 3,
        maxReplicas: 15,
      },
    });

    // Scheduled scaling rule
    performanceOptimizer.createAutoScalingRule({
      name: 'Business Hours Scaling',
      description: 'Scale resources during business hours',
      enabled: true,
      target: {
        type: 'deployment',
        identifier: 'control-panel',
        namespace: 'control-panel',
        environment: 'production',
      },
      trigger: 'schedule',
      conditions: [], // No metric conditions for scheduled scaling
      actions: [
        {
          type: 'scale_out',
          parameters: {
            targetReplicas: 5,
          },
          cooldown: 0, // No cooldown for scheduled actions
          maxRetries: 1,
        }
      ],
      constraints: {
        minReplicas: 2,
        maxReplicas: 10,
      },
      schedule: {
        timezone: 'UTC',
        rules: [
          {
            dayOfWeek: '1-5', // Monday to Friday
            timeRange: {
              start: '08:00',
              end: '18:00',
            },
            scalingFactor: 1.5,
          },
          {
            dayOfWeek: '6-7', // Weekend
            timeRange: {
              start: '00:00',
              end: '23:59',
            },
            scalingFactor: 0.5,
          }
        ],
      },
    });

    // Error rate scaling rule
    performanceOptimizer.createAutoScalingRule({
      name: 'Error Rate Response Scaling',
      description: 'Scale when error rates increase to handle traffic spikes',
      enabled: false, // Disabled by default as it's more aggressive
      target: {
        type: 'deployment',
        identifier: 'control-panel',
        namespace: 'control-panel',
        environment: 'production',
      },
      trigger: 'metric_threshold',
      conditions: [
        {
          metric: 'error_rate',
          operator: '>',
          threshold: 5, // 5% error rate
          duration: 120, // 2 minutes
        }
      ],
      actions: [
        {
          type: 'scale_out',
          parameters: {
            incrementReplicas: 3,
            emergency: true,
          },
          cooldown: 900, // 15 minutes
          maxRetries: 2,
        }
      ],
      constraints: {
        minReplicas: 2,
        maxReplicas: 20, // Higher max for emergency scaling
      },
    });
  } catch (error) {
    console.error('Error initializing sample auto-scaling rules:', error);
  }
}