import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description: string;
  tags: string[];
  authentication: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header' | 'body';
    type: string;
    required: boolean;
    description: string;
    example?: any;
  }>;
  responses: Array<{
    status: number;
    description: string;
    example?: any;
  }>;
}

const API_DOCUMENTATION: ApiEndpoint[] = [
  // Monitoring Endpoints
  {
    path: '/api/monitoring/metrics',
    method: 'GET',
    summary: 'Get system metrics',
    description: 'Retrieve current system metrics including CPU, memory, disk usage, and application performance metrics.',
    tags: ['monitoring', 'metrics'],
    authentication: true,
    rateLimit: { requests: 100, window: '15m' },
    parameters: [
      {
        name: 'timeRange',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Time range for historical metrics (1h, 6h, 24h, 7d)',
        example: '1h'
      },
      {
        name: 'source',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Filter metrics by source (k3s-cluster, api-gateway, etc.)',
        example: 'k3s-cluster'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'System metrics retrieved successfully',
        example: {
          metrics: [
            {
              id: 'cpu-usage',
              name: 'CPU Usage',
              value: 72.5,
              unit: '%',
              status: 'healthy',
              change: -2.1,
              source: 'k3s-cluster',
              lastUpdated: '2024-01-15T10:30:00Z'
            }
          ],
          timestamp: '2024-01-15T10:30:00Z'
        }
      },
      {
        status: 401,
        description: 'Authentication required'
      }
    ]
  },
  {
    path: '/api/monitoring/health',
    method: 'GET',
    summary: 'Get service health status',
    description: 'Check the health status of all services and dependencies in the infrastructure.',
    tags: ['monitoring', 'health'],
    authentication: true,
    rateLimit: { requests: 100, window: '15m' },
    responses: [
      {
        status: 200,
        description: 'Health status retrieved successfully',
        example: {
          services: [
            {
              id: 'control-panel-api',
              name: 'Control Panel API',
              status: 'healthy',
              uptime: 99.95,
              responseTime: 120,
              lastCheck: '2024-01-15T10:30:00Z'
            }
          ],
          overall: 'healthy'
        }
      }
    ]
  },
  // Alerts Endpoints
  {
    path: '/api/alerts/rules',
    method: 'GET',
    summary: 'List alert rules',
    description: 'Retrieve all configured alert rules with their current status and configuration.',
    tags: ['alerts', 'rules'],
    authentication: true,
    rateLimit: { requests: 100, window: '15m' },
    parameters: [
      {
        name: 'severity',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Filter by alert severity',
        example: 'critical'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Alert rules retrieved successfully'
      }
    ]
  },
  {
    path: '/api/alerts/rules',
    method: 'POST',
    summary: 'Create alert rule',
    description: 'Create a new alert rule for monitoring specific metrics or conditions.',
    tags: ['alerts', 'rules'],
    authentication: true,
    rateLimit: { requests: 10, window: '15m' },
    parameters: [
      {
        name: 'rule',
        in: 'body',
        type: 'object',
        required: true,
        description: 'Alert rule configuration',
        example: {
          name: 'High CPU Usage',
          severity: 'high',
          conditions: {
            operator: 'gt',
            threshold: 80,
            duration: '5m'
          }
        }
      }
    ],
    responses: [
      {
        status: 201,
        description: 'Alert rule created successfully'
      }
    ]
  },
  // Cluster Endpoints
  {
    path: '/api/cluster/nodes',
    method: 'GET',
    summary: 'Get cluster nodes',
    description: 'Retrieve information about all Kubernetes cluster nodes including status, usage, and capacity.',
    tags: ['cluster', 'kubernetes'],
    authentication: true,
    rateLimit: { requests: 100, window: '15m' },
    parameters: [
      {
        name: 'status',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Filter nodes by status',
        example: 'Ready'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Cluster nodes retrieved successfully'
      }
    ]
  },
  {
    path: '/api/cluster/nodes',
    method: 'POST',
    summary: 'Execute node operation',
    description: 'Perform operations on cluster nodes such as cordon, drain, or reboot.',
    tags: ['cluster', 'kubernetes'],
    authentication: true,
    rateLimit: { requests: 10, window: '15m' },
    parameters: [
      {
        name: 'operation',
        in: 'body',
        type: 'object',
        required: true,
        description: 'Node operation details',
        example: {
          action: 'drain',
          nodeName: 'k3s-worker-01',
          parameters: {
            gracePeriod: 300
          }
        }
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Node operation executed successfully'
      }
    ]
  },
  // Integration Endpoints
  {
    path: '/api/integrations/gitea',
    method: 'GET',
    summary: 'Get Gitea information',
    description: 'Retrieve repositories, users, organizations, and statistics from Gitea server.',
    tags: ['integrations', 'gitea'],
    authentication: true,
    rateLimit: { requests: 100, window: '15m' },
    parameters: [
      {
        name: 'endpoint',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Specific endpoint (overview, repositories, users, organizations)',
        example: 'repositories'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Gitea data retrieved successfully'
      }
    ]
  },
  // Real-time Endpoints
  {
    path: '/api/stream/metrics',
    method: 'GET',
    summary: 'Real-time metrics stream',
    description: 'Server-Sent Events stream for real-time monitoring updates including metrics, alerts, and system events.',
    tags: ['streaming', 'real-time'],
    authentication: true,
    rateLimit: { requests: 10, window: '15m' },
    parameters: [
      {
        name: 'types',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Comma-separated list of update types to receive',
        example: 'metric,alert,health'
      },
      {
        name: 'interval',
        in: 'query',
        type: 'number',
        required: false,
        description: 'Update interval in milliseconds',
        example: 5000
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Real-time stream connected',
        example: 'Content-Type: text/event-stream'
      }
    ]
  },
  // Webhook Endpoints
  {
    path: '/api/webhooks/deployment',
    method: 'POST',
    summary: 'Handle deployment webhooks',
    description: 'Process webhooks from CI/CD services like Drone, ArgoCD, Harbor, and Gitea for deployment automation.',
    tags: ['webhooks', 'deployment'],
    authentication: false,
    rateLimit: { requests: 100, window: '1m' },
    parameters: [
      {
        name: 'x-webhook-source',
        in: 'header',
        type: 'string',
        required: true,
        description: 'Source of the webhook',
        example: 'drone'
      },
      {
        name: 'payload',
        in: 'body',
        type: 'object',
        required: true,
        description: 'Webhook payload',
        example: {
          source: 'drone',
          event: 'build',
          build: {
            status: 'success',
            number: 123
          }
        }
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Webhook processed successfully'
      }
    ]
  }
];

function generateOpenAPISpec(): any {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'GMAC.IO Control Panel API',
      description: 'Comprehensive infrastructure management API for GMAC.IO control panel',
      version: '1.0.0',
      contact: {
        name: 'GMAC.IO Infrastructure Team',
        email: 'infra@gmac.io'
      }
    },
    servers: [
      {
        url: process.env.NEXTAUTH_URL || 'https://control.gmac.io',
        description: 'Production server'
      }
    ],
    tags: [
      { name: 'monitoring', description: 'System monitoring and metrics' },
      { name: 'alerts', description: 'Alert management and rules' },
      { name: 'cluster', description: 'Kubernetes cluster management' },
      { name: 'integrations', description: 'External service integrations' },
      { name: 'streaming', description: 'Real-time data streaming' },
      { name: 'webhooks', description: 'Webhook handlers' }
    ],
    components: {
      securitySchemes: {
        SessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
          description: 'NextAuth.js session cookie'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          headers: {
            'Retry-After': {
              schema: { type: 'integer' },
              description: 'Number of seconds to wait before retrying'
            }
          }
        }
      }
    },
    paths: {} as Record<string, any>
  };

  API_DOCUMENTATION.forEach(endpoint => {
    if (!spec.paths[endpoint.path]) {
      spec.paths[endpoint.path] = {};
    }

    const operation: any = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      responses: {}
    };

    // Add security if authentication required
    if (endpoint.authentication) {
      operation.security = [{ SessionAuth: [] }];
    }

    // Add parameters
    if (endpoint.parameters) {
      operation.parameters = endpoint.parameters.map(param => ({
        name: param.name,
        in: param.in,
        required: param.required,
        description: param.description,
        schema: { type: param.type },
        example: param.example
      }));
    }

    // Add responses
    endpoint.responses.forEach(response => {
      operation.responses[response.status] = {
        description: response.description,
        ...(response.example && {
          content: {
            'application/json': {
              example: response.example
            }
          }
        })
      };
    });

    // Add rate limit info to description
    if (endpoint.rateLimit) {
      operation.description += `\n\n**Rate Limit:** ${endpoint.rateLimit.requests} requests per ${endpoint.rateLimit.window}`;
    }

    spec.paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
  });

  return spec;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const tag = searchParams.get('tag');

    let documentation = API_DOCUMENTATION;

    // Filter by tag if specified
    if (tag) {
      documentation = documentation.filter(endpoint => 
        endpoint.tags.includes(tag)
      );
    }

    switch (format) {
      case 'openapi':
      case 'swagger':
        return NextResponse.json(generateOpenAPISpec());

      case 'markdown':
        let markdown = '# GMAC.IO Control Panel API Documentation\n\n';
        
        // Group by tags
        const groupedEndpoints = documentation.reduce((acc, endpoint) => {
          endpoint.tags.forEach(tag => {
            if (!acc[tag]) acc[tag] = [];
            acc[tag].push(endpoint);
          });
          return acc;
        }, {} as Record<string, ApiEndpoint[]>);

        Object.entries(groupedEndpoints).forEach(([tag, endpoints]) => {
          markdown += `## ${tag.charAt(0).toUpperCase() + tag.slice(1)}\n\n`;
          
          endpoints.forEach(endpoint => {
            markdown += `### ${endpoint.method} ${endpoint.path}\n\n`;
            markdown += `${endpoint.description}\n\n`;
            
            if (endpoint.authentication) {
              markdown += '**Authentication:** Required\n\n';
            }
            
            if (endpoint.rateLimit) {
              markdown += `**Rate Limit:** ${endpoint.rateLimit.requests} requests per ${endpoint.rateLimit.window}\n\n`;
            }

            if (endpoint.parameters?.length) {
              markdown += '**Parameters:**\n\n';
              endpoint.parameters.forEach(param => {
                markdown += `- \`${param.name}\` (${param.type}) ${param.required ? '**required**' : '*optional*'} - ${param.description}\n`;
              });
              markdown += '\n';
            }

            markdown += '**Responses:**\n\n';
            endpoint.responses.forEach(response => {
              markdown += `- \`${response.status}\` - ${response.description}\n`;
            });
            markdown += '\n---\n\n';
          });
        });

        return new NextResponse(markdown, {
          headers: { 'Content-Type': 'text/markdown' }
        });

      default:
        return NextResponse.json({
          documentation,
          meta: {
            totalEndpoints: documentation.length,
            tags: [...new Set(documentation.flatMap(e => e.tags))],
            formats: ['json', 'openapi', 'swagger', 'markdown'],
            generatedAt: new Date().toISOString()
          }
        });
    }

  } catch (error) {
    console.error('Error generating API documentation:', error);
    return NextResponse.json(
      { error: 'Failed to generate API documentation' },
      { status: 500 }
    );
  }
}

// Utility endpoint to validate API endpoints
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint parameter required' },
        { status: 400 }
      );
    }

    // Test endpoint connectivity
    const testResults: any = {
      endpoint,
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      const testUrl = new URL(endpoint, process.env.NEXTAUTH_URL);
      const response = await fetch(testUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer test-token`
        }
      });

      testResults.tests.push({
        type: 'connectivity',
        status: response.ok ? 'pass' : 'fail',
        statusCode: response.status,
        responseTime: 0 // Would measure actual response time in real implementation
      });

    } catch (error) {
      testResults.tests.push({
        type: 'connectivity',
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json(testResults);

  } catch (error) {
    console.error('Error testing API endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to test API endpoint' },
      { status: 500 }
    );
  }
}