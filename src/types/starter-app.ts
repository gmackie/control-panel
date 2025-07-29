export interface StarterIntegration {
  id: string;
  name: string;
  description: string;
  category: 'auth' | 'database' | 'payment' | 'monitoring' | 'email' | 'storage' | 'analytics';
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