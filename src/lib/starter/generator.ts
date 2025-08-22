import { StarterConfig, AVAILABLE_INTEGRATIONS } from '@/types/starter-app';

export interface ProjectFile {
  path: string;
  content: string;
}

export async function generateProjectFiles(config: StarterConfig): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];

  // Generate package.json
  files.push({
    path: 'package.json',
    content: generatePackageJson(config)
  });

  // Generate TypeScript config if enabled
  if (config.typescript) {
    files.push({
      path: 'tsconfig.json',
      content: generateTsConfig()
    });
  }

  // Generate Next.js config
  files.push({
    path: 'next.config.js',
    content: generateNextConfig(config)
  });

  // Generate .env.example
  files.push({
    path: '.env.example',
    content: generateEnvExample(config)
  });

  // Generate .gitignore
  files.push({
    path: '.gitignore',
    content: generateGitignore()
  });

  // Generate README
  files.push({
    path: 'README.md',
    content: generateReadme(config)
  });

  // Generate app layout
  files.push({
    path: config.typescript ? 'src/app/layout.tsx' : 'src/app/layout.js',
    content: generateLayout(config)
  });

  // Generate home page
  files.push({
    path: config.typescript ? 'src/app/page.tsx' : 'src/app/page.js',
    content: generateHomePage(config)
  });

  // Generate global styles
  files.push({
    path: 'src/app/globals.css',
    content: generateGlobalStyles(config)
  });

  // Add integration-specific files
  for (const integrationId of config.integrations) {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
    if (integration) {
      // Add setup files
      for (const setupFile of integration.setupFiles) {
        files.push({
          path: setupFile.path,
          content: setupFile.content
        });
      }

      // Add config files
      for (const configFile of integration.configFiles) {
        const content = typeof configFile.content === 'function' 
          ? configFile.content(config)
          : configFile.content;
        
        if (configFile.merge) {
          // Merge with existing file
          const existingFile = files.find(f => f.path === configFile.path);
          if (existingFile) {
            existingFile.content = mergeConfigFile(existingFile.content, content);
          }
        } else {
          files.push({
            path: configFile.path,
            content
          });
        }
      }
    }
  }

  // Add feature-specific files
  for (const feature of config.features) {
    for (const file of feature.files) {
      files.push({
        path: file.path,
        content: file.content
      });
    }
  }
  
  // Add Kubernetes manifests if observability integrations are selected
  const hasObservability = config.integrations.some(id => 
    ['prometheus', 'loki', 'grafana', 'alertmanager'].includes(id)
  );
  
  if (hasObservability) {
    files.push(...generateObservabilityManifests(config));
  }

  // Add testing setup if enabled
  if (config.testing !== 'none') {
    files.push(...generateTestingFiles(config));
  }

  // Add ESLint config if enabled
  if (config.eslint) {
    files.push({
      path: '.eslintrc.json',
      content: generateEslintConfig(config)
    });
  }

  // Add Prettier config if enabled
  if (config.prettier) {
    files.push({
      path: '.prettierrc',
      content: generatePrettierConfig()
    });
  }

  return files;
}

function generatePackageJson(config: StarterConfig): string {
  const { projectName, integrations, typescript, testing, eslint, prettier } = config;

  const dependencies: Record<string, string> = {
    'next': '^14.0.0',
    'react': '^18',
    'react-dom': '^18',
  };

  const devDependencies: Record<string, string> = {};

  // Add TypeScript dependencies
  if (typescript) {
    devDependencies['typescript'] = '^5';
    devDependencies['@types/node'] = '^20';
    devDependencies['@types/react'] = '^18';
    devDependencies['@types/react-dom'] = '^18';
  }

  // Add styling dependencies
  if (config.styling === 'tailwind') {
    devDependencies['tailwindcss'] = '^3';
    devDependencies['postcss'] = '^8';
    devDependencies['autoprefixer'] = '^10';
  }

  // Add integration dependencies
  for (const integrationId of integrations) {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
    if (integration) {
      integration.dependencies.forEach(dep => {
        dependencies[dep] = 'latest';
      });
      integration.devDependencies?.forEach(dep => {
        devDependencies[dep] = 'latest';
      });
    }
  }

  // Add testing dependencies
  if (testing === 'jest') {
    devDependencies['jest'] = '^29';
    devDependencies['@testing-library/react'] = '^14';
    devDependencies['@testing-library/jest-dom'] = '^6';
    if (typescript) {
      devDependencies['@types/jest'] = '^29';
    }
  } else if (testing === 'vitest') {
    devDependencies['vitest'] = '^0.34';
    devDependencies['@testing-library/react'] = '^14';
  } else if (testing === 'playwright') {
    devDependencies['@playwright/test'] = '^1.40';
  }

  // Add linting dependencies
  if (eslint) {
    devDependencies['eslint'] = '^8';
    devDependencies['eslint-config-next'] = '^14';
  }

  if (prettier) {
    devDependencies['prettier'] = '^3';
  }

  const packageJson = {
    name: projectName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: eslint ? 'next lint' : undefined,
      format: prettier ? 'prettier --write .' : undefined,
      test: testing === 'jest' ? 'jest' : testing === 'vitest' ? 'vitest' : testing === 'playwright' ? 'playwright test' : undefined,
    },
    dependencies,
    devDependencies,
  };

  // Remove undefined scripts
  Object.keys(packageJson.scripts).forEach(key => {
    if (packageJson.scripts[key as keyof typeof packageJson.scripts] === undefined) {
      delete packageJson.scripts[key as keyof typeof packageJson.scripts];
    }
  });

  return JSON.stringify(packageJson, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [
        {
          name: 'next'
        }
      ],
      paths: {
        '@/*': ['./src/*']
      }
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules']
  }, null, 2);
}

function generateNextConfig(config: StarterConfig): string {
  const integrations = config.integrations;
  let configContent = `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
}`;

  // Add Sentry config if included
  if (integrations.includes('sentry')) {
    configContent = `const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
}

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);`;
  } else {
    configContent += '\n\nmodule.exports = nextConfig;';
  }

  return configContent;
}

function generateEnvExample(config: StarterConfig): string {
  const lines: string[] = ['# Copy this file to .env.local and fill in the values\n'];

  for (const integrationId of config.integrations) {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
    if (integration) {
      lines.push(`# ${integration.name}`);
      for (const envVar of integration.requiredEnvVars) {
        lines.push(`${envVar.name}=${envVar.defaultValue || ''}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateGitignore(): string {
  return `# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts`;
}

function generateReadme(config: StarterConfig): string {
  const { projectName, description, integrations } = config;
  
  let readme = `# ${projectName}\n\n`;
  
  if (description) {
    readme += `${description}\n\n`;
  }
  
  readme += `## Getting Started\n\n`;
  readme += `First, run the development server:\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `npm run dev\n`;
  readme += `# or\n`;
  readme += `yarn dev\n`;
  readme += `# or\n`;
  readme += `pnpm dev\n`;
  readme += `# or\n`;
  readme += `bun dev\n`;
  readme += `\`\`\`\n\n`;
  
  readme += `Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.\n\n`;
  
  if (integrations.length > 0) {
    readme += `## Integrations\n\n`;
    readme += `This project includes the following integrations:\n\n`;
    
    for (const integrationId of integrations) {
      const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
      if (integration) {
        readme += `- **${integration.name}**: ${integration.description}\n`;
      }
    }
    
    readme += `\nSee the setup instructions for configuration details.\n`;
  }
  
  return readme;
}

function generateLayout(config: StarterConfig): string {
  const { typescript, integrations, styling } = config;
  const ext = typescript ? 'tsx' : 'js';
  
  let imports = '';
  let providers = '';
  
  // Add styling imports
  if (styling === 'tailwind') {
    imports += `import './globals.css'\n`;
  }
  
  // Add Clerk provider if included
  if (integrations.includes('clerk')) {
    imports += `import { ClerkProvider } from '@clerk/nextjs'\n`;
    providers = `<ClerkProvider>`;
  }
  
  // Add TypeScript types
  const typeAnnotations = typescript ? `
export const metadata${typescript ? ': Metadata' : ''} = {
  title: '${config.projectName}',
  description: '${config.description || 'Generated with Next.js Starter'}',
}

export default function RootLayout({
  children,
}${typescript ? ': {\n  children: React.ReactNode\n}' : ''}) {` : `
export const metadata = {
  title: '${config.projectName}',
  description: '${config.description || 'Generated with Next.js Starter'}',
}

export default function RootLayout({ children }) {`;

  if (typescript) {
    imports = `import type { Metadata } from 'next'\n` + imports;
  }

  return `${imports}
${typeAnnotations}
  return (
    ${providers ? providers + '\n      ' : ''}<html lang="en">
        <body>${providers ? '\n          ' : ''}{children}${providers ? '\n        ' : ''}</body>
      </html>${providers ? '\n    </ClerkProvider>' : ''}
  )
}`;
}

function generateHomePage(config: StarterConfig): string {
  const { typescript, integrations } = config;
  
  let imports = '';
  let content = '';
  
  // Add authentication UI if Clerk is included
  if (integrations.includes('clerk')) {
    imports += typescript 
      ? `import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'\n`
      : `import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'\n`;
    
    content = `
      <nav className="flex justify-between items-center p-4">
        <h1 className="text-2xl font-bold">${config.projectName}</h1>
        <div>
          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </nav>`;
  }
  
  return `${imports}
export default function Home() {
  return (
    <main className="min-h-screen">
      ${content || `<div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold mb-4">Welcome to ${config.projectName}</h1>
        <p className="text-lg text-gray-600">Get started by editing src/app/page.${typescript ? 'tsx' : 'js'}</p>
      </div>`}
    </main>
  )
}`;
}

function generateGlobalStyles(config: StarterConfig): string {
  if (config.styling === 'tailwind') {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
  }
  
  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;
  }
  
  return `* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

a {
  color: inherit;
  text-decoration: none;
}`;
}

function generateTestingFiles(config: StarterConfig): ProjectFile[] {
  const files: ProjectFile[] = [];
  
  if (config.testing === 'jest') {
    files.push({
      path: 'jest.config.js',
      content: `const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
}

module.exports = createJestConfig(customJestConfig)`
    });
    
    files.push({
      path: 'jest.setup.js',
      content: `import '@testing-library/jest-dom'`
    });
  } else if (config.testing === 'vitest') {
    files.push({
      path: 'vitest.config.ts',
      content: `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
})`
    });
    
    files.push({
      path: 'vitest.setup.ts',
      content: `import '@testing-library/jest-dom'`
    });
  } else if (config.testing === 'playwright') {
    files.push({
      path: 'playwright.config.ts',
      content: `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});`
    });
  }
  
  return files;
}

function generateEslintConfig(config: StarterConfig): string {
  const rules: Record<string, any> = {};
  
  if (config.typescript) {
    rules['@typescript-eslint/no-unused-vars'] = 'warn';
  }
  
  return JSON.stringify({
    extends: config.typescript ? ['next/core-web-vitals', 'next/typescript'] : ['next/core-web-vitals'],
    rules
  }, null, 2);
}

function generatePrettierConfig(): string {
  return JSON.stringify({
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
  }, null, 2);
}

function mergeConfigFile(existing: string, additional: string): string {
  // Simple merge logic - in real implementation, this would be more sophisticated
  return existing.replace('module.exports', `// Additional config
${additional}

// Original config
module.exports`);
}

function generateObservabilityManifests(config: StarterConfig): ProjectFile[] {
  const files: ProjectFile[] = [];
  const appName = config.projectName;
  
  // Service Monitor for Prometheus
  if (config.integrations.includes('prometheus')) {
    files.push({
      path: 'k8s/monitoring/service-monitor.yaml',
      content: `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${appName}
  namespace: default
  labels:
    app: ${appName}
    prometheus: kube-prometheus
spec:
  selector:
    matchLabels:
      app: ${appName}
  endpoints:
  - port: metrics
    interval: 30s
    path: /api/metrics`
    });
  }
  
  // ConfigMap for Loki configuration
  if (config.integrations.includes('loki')) {
    files.push({
      path: 'k8s/monitoring/fluentbit-config.yaml',
      content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${appName}-fluentbit-config
  namespace: default
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off

    [INPUT]
        Name              tail
        Path              /var/log/containers/${appName}*.log
        Parser            docker
        Tag               ${appName}.*
        Refresh_Interval  5

    [OUTPUT]
        Name   loki
        Match  ${appName}.*
        Host   loki.monitoring.svc.cluster.local
        Port   3100
        Labels job=${appName}, namespace=default`
    });
  }
  
  // Deployment with observability annotations
  files.push({
    path: 'k8s/deployment.yaml',
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName}
  namespace: default
  labels:
    app: ${appName}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${appName}
  template:
    metadata:
      labels:
        app: ${appName}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/api/metrics"
    spec:
      containers:
      - name: ${appName}
        image: ${appName}:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 3000
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: PROMETHEUS_PUSHGATEWAY_URL
          value: "http://prometheus-pushgateway.monitoring.svc.cluster.local:9091"
        - name: LOKI_PUSH_URL
          value: "http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push"
        - name: GRAFANA_URL
          value: "http://grafana.monitoring.svc.cluster.local:3000"
        - name: ALERTMANAGER_URL
          value: "http://alertmanager.monitoring.svc.cluster.local:9093"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: ${appName}
  namespace: default
  labels:
    app: ${appName}
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    name: http
  - port: 3000
    targetPort: 3000
    name: metrics
  selector:
    app: ${appName}`
  });
  
  // Health check endpoints
  files.push({
    path: 'src/app/api/health/route.ts',
    content: `import { NextResponse } from 'next/server';

export async function GET() {
  // Perform health checks
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  
  return NextResponse.json(health);
}`
  });
  
  files.push({
    path: 'src/app/api/ready/route.ts',
    content: `import { NextResponse } from 'next/server';

export async function GET() {
  // Check if app is ready to serve traffic
  const ready = {
    ready: true,
    timestamp: new Date().toISOString(),
  };
  
  return NextResponse.json(ready);
}`
  });
  
  // Docker Compose for local observability stack
  files.push({
    path: 'docker-compose.observability.yml',
    content: `version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - monitoring

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./grafana:/etc/grafana/provisioning
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager/config.yml:/etc/alertmanager/config.yml
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge`
  });
  
  // Prometheus configuration
  files.push({
    path: 'prometheus/prometheus.yml',
    content: `global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: '${appName}'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/api/metrics'`
  });
  
  // AlertManager configuration
  files.push({
    path: 'alertmanager/config.yml',
    content: `global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://host.docker.internal:3000/api/alerts/webhook'
    send_resolved: true`
  });
  
  return files;
}