export interface StarterIntegration {
  id: string;
  name: string;
  description: string;
  category: 'auth' | 'database' | 'payment' | 'monitoring' | 'email' | 'storage' | 'analytics' | 'communication' | 'ai' | 'observability';
  icon?: string;
  requiredEnvVars: EnvVariable[];
  dependencies: string[];
  devDependencies?: string[];
  setupFiles: SetupFile[];
  configFiles: ConfigFile[];
  incompatibleWith?: string[]; // IDs of incompatible integrations
  requiredBy?: string[]; // IDs of integrations that require this one
}

export interface EnvVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example: string;
}

export interface SetupFile {
  path: string;
  content: string;
  condition?: string; // JavaScript expression to evaluate
}

export interface ConfigFile {
  path: string;
  content: string | ((config: StarterConfig) => string);
  merge?: boolean; // If true, merge with existing file content
}

export interface StarterConfig {
  projectName: string;
  description?: string;
  integrations: string[]; // Integration IDs
  features: StarterFeature[];
  styling: 'tailwind' | 'css-modules' | 'styled-components' | 'emotion';
  typescript: boolean;
  eslint: boolean;
  prettier: boolean;
  testing: 'none' | 'jest' | 'vitest' | 'playwright';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  deployment: 'vercel' | 'netlify' | 'docker' | 'k3s' | 'none';
}

export interface StarterFeature {
  id: string;
  name: string;
  description: string;
  files: SetupFile[];
}

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  preselectedIntegrations: string[];
  recommended: boolean;
}

// Integration definitions
export const AVAILABLE_INTEGRATIONS: StarterIntegration[] = [
  {
    id: 'clerk',
    name: 'Clerk',
    description: 'Authentication and user management',
    category: 'auth',
    requiredEnvVars: [
      {
        name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        description: 'Clerk publishable key',
        required: true,
        example: 'pk_test_...'
      },
      {
        name: 'CLERK_SECRET_KEY',
        description: 'Clerk secret key',
        required: true,
        example: 'sk_test_...'
      }
    ],
    dependencies: ['@clerk/nextjs'],
    setupFiles: [
      {
        path: 'src/app/layout.tsx',
        content: `import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}`
      },
      {
        path: 'middleware.ts',
        content: `import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/api/webhooks(.*)"]
});

export const config = {
  matcher: ["/((?!.+\\\\.[\\\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};`
      }
    ],
    configFiles: []
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and subscriptions',
    category: 'payment',
    requiredEnvVars: [
      {
        name: 'STRIPE_SECRET_KEY',
        description: 'Stripe secret key',
        required: true,
        example: 'sk_test_...'
      },
      {
        name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        description: 'Stripe publishable key',
        required: true,
        example: 'pk_test_...'
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        description: 'Stripe webhook endpoint secret',
        required: false,
        example: 'whsec_...'
      }
    ],
    dependencies: ['stripe', '@stripe/stripe-js'],
    setupFiles: [
      {
        path: 'src/lib/stripe.ts',
        content: `import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});`
      },
      {
        path: 'src/lib/stripe-client.ts',
        content: `import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);`
      }
    ],
    configFiles: []
  },
  {
    id: 'turso',
    name: 'Turso',
    description: 'Edge database powered by LibSQL',
    category: 'database',
    requiredEnvVars: [
      {
        name: 'TURSO_DATABASE_URL',
        description: 'Turso database URL',
        required: true,
        example: 'libsql://...'
      },
      {
        name: 'TURSO_AUTH_TOKEN',
        description: 'Turso authentication token',
        required: true,
        example: '...'
      }
    ],
    dependencies: ['@libsql/client'],
    devDependencies: ['@libsql/kysely-libsql', 'kysely'],
    setupFiles: [
      {
        path: 'src/lib/db.ts',
        content: `import { createClient } from '@libsql/client';

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});`
      }
    ],
    configFiles: []
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative',
    category: 'database',
    incompatibleWith: ['turso'],
    requiredEnvVars: [
      {
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        description: 'Supabase project URL',
        required: true,
        example: 'https://xxxxx.supabase.co'
      },
      {
        name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        description: 'Supabase anonymous key',
        required: true,
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    ],
    dependencies: ['@supabase/supabase-js', '@supabase/auth-helpers-nextjs'],
    setupFiles: [
      {
        path: 'src/lib/supabase.ts',
        content: `import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)`
      }
    ],
    configFiles: []
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error tracking and performance monitoring',
    category: 'monitoring',
    requiredEnvVars: [
      {
        name: 'NEXT_PUBLIC_SENTRY_DSN',
        description: 'Sentry DSN',
        required: true,
        example: 'https://xxx@xxx.ingest.sentry.io/xxx'
      },
      {
        name: 'SENTRY_ORG',
        description: 'Sentry organization slug',
        required: false,
        example: 'my-org'
      },
      {
        name: 'SENTRY_PROJECT',
        description: 'Sentry project name',
        required: false,
        example: 'my-project'
      }
    ],
    dependencies: ['@sentry/nextjs'],
    setupFiles: [
      {
        path: 'sentry.client.config.ts',
        content: `import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});`
      },
      {
        path: 'sentry.server.config.ts',
        content: `import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});`
      }
    ],
    configFiles: [
      {
        path: 'next.config.js',
        content: (config) => `const { withSentryConfig } = require("@sentry/nextjs");

const moduleExports = {
  // Your existing Next.js config
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
};

module.exports = withSentryConfig(moduleExports, sentryWebpackPluginOptions);`,
        merge: true
      }
    ]
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Modern email API',
    category: 'email',
    requiredEnvVars: [
      {
        name: 'RESEND_API_KEY',
        description: 'Resend API key',
        required: true,
        example: 're_...'
      }
    ],
    dependencies: ['resend'],
    setupFiles: [
      {
        path: 'src/lib/email.ts',
        content: `import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);`
      }
    ],
    configFiles: []
  },
  {
    id: 'posthog',
    name: 'PostHog',
    description: 'Product analytics and feature flags',
    category: 'analytics',
    requiredEnvVars: [
      {
        name: 'NEXT_PUBLIC_POSTHOG_KEY',
        description: 'PostHog project API key',
        required: true,
        example: 'phc_...'
      },
      {
        name: 'NEXT_PUBLIC_POSTHOG_HOST',
        description: 'PostHog API host',
        required: false,
        defaultValue: 'https://app.posthog.com',
        example: 'https://app.posthog.com'
      }
    ],
    dependencies: ['posthog-js'],
    setupFiles: [
      {
        path: 'src/lib/posthog.ts',
        content: `import posthog from 'posthog-js'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') posthog.debug()
    }
  })
}

export default posthog`
      }
    ],
    configFiles: []
  },
  {
    id: 'uploadthing',
    name: 'UploadThing',
    description: 'File uploads for Next.js',
    category: 'storage',
    requiredEnvVars: [
      {
        name: 'UPLOADTHING_SECRET',
        description: 'UploadThing secret key',
        required: true,
        example: 'sk_live_...'
      },
      {
        name: 'UPLOADTHING_APP_ID',
        description: 'UploadThing app ID',
        required: true,
        example: '...'
      }
    ],
    dependencies: ['uploadthing', '@uploadthing/react'],
    setupFiles: [
      {
        path: 'src/app/api/uploadthing/core.ts',
        content: `import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;`
      }
    ],
    configFiles: []
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Email delivery and marketing platform',
    category: 'email',
    requiredEnvVars: [
      {
        name: 'SENDGRID_API_KEY',
        description: 'SendGrid API key',
        required: true,
        example: 'SG...'
      },
      {
        name: 'SENDGRID_FROM_EMAIL',
        description: 'Default from email address',
        required: true,
        example: 'noreply@example.com'
      }
    ],
    dependencies: ['@sendgrid/mail'],
    setupFiles: [
      {
        path: 'src/lib/sendgrid.ts',
        content: `import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export { sgMail };`
      }
    ],
    configFiles: []
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, voice calls, and communication APIs',
    category: 'communication',
    requiredEnvVars: [
      {
        name: 'TWILIO_ACCOUNT_SID',
        description: 'Twilio Account SID',
        required: true,
        example: 'AC...'
      },
      {
        name: 'TWILIO_AUTH_TOKEN',
        description: 'Twilio Auth Token',
        required: true,
        example: '...'
      },
      {
        name: 'TWILIO_PHONE_NUMBER',
        description: 'Twilio phone number',
        required: true,
        example: '+1234567890'
      }
    ],
    dependencies: ['twilio'],
    setupFiles: [
      {
        path: 'src/lib/twilio.ts',
        content: `import twilio from 'twilio';

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);`
      }
    ],
    configFiles: []
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'AI voice synthesis and text-to-speech',
    category: 'ai',
    requiredEnvVars: [
      {
        name: 'ELEVENLABS_API_KEY',
        description: 'ElevenLabs API key',
        required: true,
        example: '...'
      },
      {
        name: 'ELEVENLABS_VOICE_ID',
        description: 'Default voice ID',
        required: false,
        example: '21m00Tcm4TlvDq8ikWAM'
      }
    ],
    dependencies: ['elevenlabs'],
    setupFiles: [
      {
        path: 'src/lib/elevenlabs.ts',
        content: `import { ElevenLabsApi, ElevenLabsConfig } from 'elevenlabs';

const config = new ElevenLabsConfig({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

export const elevenlabs = new ElevenLabsApi(config);`
      }
    ],
    configFiles: []
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified API for multiple AI models',
    category: 'ai',
    requiredEnvVars: [
      {
        name: 'OPENROUTER_API_KEY',
        description: 'OpenRouter API key',
        required: true,
        example: 'sk-or-...'
      },
      {
        name: 'OPENROUTER_DEFAULT_MODEL',
        description: 'Default model to use',
        required: false,
        example: 'openai/gpt-3.5-turbo'
      }
    ],
    dependencies: ['openai'],
    setupFiles: [
      {
        path: 'src/lib/openrouter.ts',
        content: `import OpenAI from 'openai';

export const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
    'X-Title': process.env.SITE_NAME || 'My App',
  },
});`
      }
    ],
    configFiles: []
  },
  {
    id: 'nextauth',
    name: 'NextAuth.js',
    description: 'Authentication library for Next.js',
    category: 'auth',
    incompatibleWith: ['clerk'],
    requiredEnvVars: [
      {
        name: 'NEXTAUTH_SECRET',
        description: 'NextAuth secret key',
        required: true,
        example: 'your-secret-here'
      },
      {
        name: 'NEXTAUTH_URL',
        description: 'NextAuth URL',
        required: true,
        example: 'http://localhost:3000'
      },
      {
        name: 'GITHUB_ID',
        description: 'GitHub OAuth App ID',
        required: true,
        example: '...'
      },
      {
        name: 'GITHUB_SECRET',
        description: 'GitHub OAuth App Secret',
        required: true,
        example: '...'
      }
    ],
    dependencies: ['next-auth'],
    setupFiles: [
      {
        path: 'src/lib/auth.ts',
        content: `import { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
};`
      },
      {
        path: 'src/app/api/auth/[...nextauth]/route.ts',
        content: `import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };`
      }
    ],
    configFiles: []
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Metrics collection and monitoring',
    category: 'observability',
    requiredEnvVars: [
      {
        name: 'PROMETHEUS_PUSHGATEWAY_URL',
        description: 'Prometheus Pushgateway URL',
        required: true,
        example: 'http://pushgateway.monitoring.svc.cluster.local:9091'
      },
      {
        name: 'PROMETHEUS_JOB_NAME',
        description: 'Job name for Prometheus metrics',
        required: false,
        defaultValue: 'nextjs-app',
        example: 'my-app'
      }
    ],
    dependencies: ['prom-client'],
    setupFiles: [
      {
        path: 'src/lib/metrics.ts',
        content: `import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Create a Registry
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
  registers: [register],
});

// Middleware to track metrics
export function trackMetrics(req: Request, res: Response, duration: number) {
  const route = req.url || 'unknown';
  const method = req.method || 'GET';
  const status = res.status || 200;
  
  httpRequestDuration.labels(method, route, String(status)).observe(duration);
  httpRequestTotal.labels(method, route, String(status)).inc();
}`
      },
      {
        path: 'src/app/api/metrics/route.ts',
        content: `import { NextResponse } from 'next/server';
import { register } from '@/lib/metrics';

export async function GET() {
  try {
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      headers: {
        'Content-Type': register.contentType,
      },
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 });
  }
}`
      },
      {
        path: 'src/middleware.ts',
        content: `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { httpRequestDuration, httpRequestTotal } from '@/lib/metrics';

export function middleware(request: NextRequest) {
  const start = Date.now();
  
  const response = NextResponse.next();
  
  // Track metrics after response
  const duration = (Date.now() - start) / 1000;
  const method = request.method;
  const route = request.nextUrl.pathname;
  const status = response.status;
  
  httpRequestDuration.labels(method, route, String(status)).observe(duration);
  httpRequestTotal.labels(method, route, String(status)).inc();
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};`
      }
    ],
    configFiles: []
  },
  {
    id: 'loki',
    name: 'Loki',
    description: 'Log aggregation and querying',
    category: 'observability',
    requiredEnvVars: [
      {
        name: 'LOKI_PUSH_URL',
        description: 'Loki push endpoint URL',
        required: true,
        example: 'http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push'
      },
      {
        name: 'LOKI_LABELS',
        description: 'Default labels for logs',
        required: false,
        defaultValue: '{"app":"nextjs","env":"production"}',
        example: '{"app":"my-app","env":"prod"}'
      }
    ],
    dependencies: ['winston', 'winston-loki'],
    setupFiles: [
      {
        path: 'src/lib/logger.ts',
        content: `import winston from 'winston';
import LokiTransport from 'winston-loki';

const labels = process.env.LOKI_LABELS ? JSON.parse(process.env.LOKI_LABELS) : {
  app: process.env.APP_NAME || 'nextjs-app',
  env: process.env.NODE_ENV || 'development',
};

export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add Loki transport in production
if (process.env.NODE_ENV === 'production' && process.env.LOKI_PUSH_URL) {
  logger.add(
    new LokiTransport({
      host: process.env.LOKI_PUSH_URL,
      labels,
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => console.error('Loki connection error:', err),
    })
  );
}

// Helper functions
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: any) => {
  logger.error(message, { error: error?.message || error, stack: error?.stack });
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};`
      },
      {
        path: 'src/lib/request-logger.ts',
        content: `import { logger } from './logger';

export function logRequest(req: Request, res: Response, duration: number) {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.status,
    duration: duration,
    userAgent: req.headers.get('user-agent'),
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  };
  
  if (res.status >= 500) {
    logger.error('Server error', logData);
  } else if (res.status >= 400) {
    logger.warn('Client error', logData);
  } else {
    logger.info('Request completed', logData);
  }
}`
      }
    ],
    configFiles: []
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Dashboards and visualization setup',
    category: 'observability',
    requiredEnvVars: [
      {
        name: 'GRAFANA_URL',
        description: 'Grafana instance URL',
        required: true,
        example: 'http://grafana.monitoring.svc.cluster.local:3000'
      },
      {
        name: 'GRAFANA_API_KEY',
        description: 'Grafana API key for annotations',
        required: false,
        example: 'glsa_...'
      }
    ],
    dependencies: ['axios'],
    setupFiles: [
      {
        path: 'src/lib/grafana.ts',
        content: `import axios from 'axios';

const grafanaUrl = process.env.GRAFANA_URL;
const apiKey = process.env.GRAFANA_API_KEY;

export interface Annotation {
  dashboardUID?: string;
  panelId?: number;
  time?: number;
  timeEnd?: number;
  tags?: string[];
  text: string;
}

export async function createAnnotation(annotation: Annotation) {
  if (!grafanaUrl || !apiKey) {
    console.warn('Grafana not configured, skipping annotation');
    return;
  }
  
  try {
    const response = await axios.post(
      \`\${grafanaUrl}/api/annotations\`,
      {
        ...annotation,
        time: annotation.time || Date.now(),
      },
      {
        headers: {
          'Authorization': \`Bearer \${apiKey}\`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to create Grafana annotation:', error);
  }
}

// Create deployment annotation
export async function annotateDeployment(version: string, environment: string) {
  return createAnnotation({
    tags: ['deployment', environment],
    text: \`Deployed version \${version} to \${environment}\`,
  });
}

// Create incident annotation
export async function annotateIncident(description: string, severity: 'low' | 'medium' | 'high' | 'critical') {
  return createAnnotation({
    tags: ['incident', severity],
    text: description,
  });
}`
      },
      {
        path: 'grafana/dashboard.json',
        content: `{
  "dashboard": {
    "title": "Next.js Application Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "active_users",
            "legendFormat": "Active Users"
          }
        ],
        "type": "stat"
      }
    ],
    "refresh": "10s",
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }
}`
      }
    ],
    configFiles: []
  },
  {
    id: 'alertmanager',
    name: 'AlertManager',
    description: 'Alert routing and management',
    category: 'observability',
    requiredEnvVars: [
      {
        name: 'ALERTMANAGER_URL',
        description: 'AlertManager API URL',
        required: true,
        example: 'http://alertmanager.monitoring.svc.cluster.local:9093'
      },
      {
        name: 'ALERT_WEBHOOK_URL',
        description: 'Webhook URL for receiving alerts',
        required: false,
        example: 'https://your-app.com/api/alerts/webhook'
      }
    ],
    dependencies: ['axios'],
    setupFiles: [
      {
        path: 'src/lib/alerts.ts',
        content: `import axios from 'axios';

const alertmanagerUrl = process.env.ALERTMANAGER_URL;

export interface Alert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
}

export async function sendAlert(alert: Alert) {
  if (!alertmanagerUrl) {
    console.warn('AlertManager not configured, skipping alert');
    return;
  }
  
  try {
    const response = await axios.post(
      \`\${alertmanagerUrl}/api/v1/alerts\`,
      [{
        ...alert,
        startsAt: alert.startsAt || new Date().toISOString(),
        labels: {
          ...alert.labels,
          alertname: alert.labels.alertname || 'ApplicationAlert',
          severity: alert.labels.severity || 'warning',
        },
      }],
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

// High error rate alert
export async function alertHighErrorRate(errorRate: number, threshold: number) {
  return sendAlert({
    labels: {
      alertname: 'HighErrorRate',
      severity: 'critical',
      service: process.env.APP_NAME || 'nextjs-app',
    },
    annotations: {
      summary: 'High error rate detected',
      description: \`Error rate is \${errorRate}% (threshold: \${threshold}%)\`,
    },
  });
}

// High response time alert
export async function alertHighResponseTime(responseTime: number, threshold: number) {
  return sendAlert({
    labels: {
      alertname: 'HighResponseTime',
      severity: 'warning',
      service: process.env.APP_NAME || 'nextjs-app',
    },
    annotations: {
      summary: 'High response time detected',
      description: \`Response time is \${responseTime}ms (threshold: \${threshold}ms)\`,
    },
  });
}`
      },
      {
        path: 'src/app/api/alerts/webhook/route.ts',
        content: `import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const alerts = await request.json();
    
    // Process incoming alerts from AlertManager
    for (const alert of alerts) {
      const severity = alert.labels?.severity || 'unknown';
      const alertname = alert.labels?.alertname || 'Unknown Alert';
      const description = alert.annotations?.description || 'No description';
      
      logger.warn(\`Alert received: \${alertname}\`, {
        severity,
        description,
        labels: alert.labels,
        annotations: alert.annotations,
      });
      
      // Handle different alert types
      switch (alertname) {
        case 'HighErrorRate':
          // Trigger error rate mitigation
          break;
        case 'HighResponseTime':
          // Trigger performance optimization
          break;
        default:
          // Generic alert handling
          break;
      }
    }
    
    return NextResponse.json({ status: 'acknowledged' });
  } catch (error) {
    logger.error('Failed to process alert webhook', error);
    return NextResponse.json({ error: 'Failed to process alerts' }, { status: 500 });
  }
}`
      },
      {
        path: 'prometheus/alerts.yml',
        content: `groups:
  - name: application_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          service: "{{ $labels.job }}"
        annotations:
          summary: "High error rate on {{ $labels.job }}"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.job }}"
      
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
          service: "{{ $labels.job }}"
        annotations:
          summary: "High response time on {{ $labels.job }}"
          description: "95th percentile response time is {{ $value }}s for {{ $labels.job }}"
      
      - alert: ApplicationDown
        expr: up{job="nextjs-app"} == 0
        for: 1m
        labels:
          severity: critical
          service: "{{ $labels.job }}"
        annotations:
          summary: "Application {{ $labels.job }} is down"
          description: "{{ $labels.job }} has been down for more than 1 minute"`
      }
    ],
    configFiles: []
  }
];

// Starter templates
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'Full-stack SaaS application with auth, payments, and database',
    preselectedIntegrations: ['clerk', 'stripe', 'turso', 'resend', 'sentry'],
    recommended: true
  },
  {
    id: 'blog',
    name: 'Blog/Content Site',
    description: 'Content-focused site with auth and analytics',
    preselectedIntegrations: ['clerk', 'turso', 'posthog'],
    recommended: false
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Online store with payments and email',
    preselectedIntegrations: ['clerk', 'stripe', 'turso', 'resend', 'uploadthing'],
    recommended: false
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Basic Next.js setup with no integrations',
    preselectedIntegrations: [],
    recommended: false
  }
];