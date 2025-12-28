import { NextRequest, NextResponse } from 'next/server';
import { StarterConfig, AVAILABLE_INTEGRATIONS } from '@/types/starter-app';
import { generateProjectFiles } from '@/lib/starter/generator';

export async function POST(request: NextRequest) {
  try {
    const config: StarterConfig = await request.json();

    // Validate configuration
    const errors = validateConfig(config);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid configuration', errors },
        { status: 400 }
      );
    }

    // Generate project files
    const projectFiles = await generateProjectFiles(config);

    // Return the generated files structure
    return NextResponse.json({
      success: true,
      config,
      files: projectFiles,
      instructions: generateSetupInstructions(config)
    });
  } catch (error) {
    console.error('Error generating starter app:', error);
    return NextResponse.json(
      { error: 'Failed to generate starter app' },
      { status: 500 }
    );
  }
}

function validateConfig(config: StarterConfig): string[] {
  const errors: string[] = [];

  if (!config.projectName || config.projectName.trim() === '') {
    errors.push('Project name is required');
  }

  if (!/^[a-z0-9-]+$/.test(config.projectName)) {
    errors.push('Project name must contain only lowercase letters, numbers, and hyphens');
  }

  // Validate integration compatibility
  const integrations = config.integrations || [];
  for (const integrationId of integrations) {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
    if (!integration) {
      errors.push(`Unknown integration: ${integrationId}`);
      continue;
    }

    // Check for incompatible integrations
    if (integration.incompatibleWith) {
      for (const incompatibleId of integration.incompatibleWith) {
        if (integrations.includes(incompatibleId)) {
          errors.push(`${integration.name} is incompatible with ${incompatibleId}`);
        }
      }
    }

    // Check for required dependencies
    if (integration.requiredBy) {
      for (const requiredId of integration.requiredBy) {
        if (!integrations.includes(requiredId)) {
          errors.push(`${integration.name} requires ${requiredId}`);
        }
      }
    }
  }

  return errors;
}

function generateSetupInstructions(config: StarterConfig): string {
  const { projectName, integrations, packageManager } = config;
  
  const instructions: string[] = [];
  
  instructions.push(`# Setup Instructions for ${projectName}`);
  instructions.push('');
  instructions.push('## 1. Create project directory and install dependencies');
  instructions.push('```bash');
  instructions.push(`mkdir ${projectName}`);
  instructions.push(`cd ${projectName}`);
  
  switch (packageManager) {
    case 'yarn':
      instructions.push('yarn install');
      break;
    case 'pnpm':
      instructions.push('pnpm install');
      break;
    case 'bun':
      instructions.push('bun install');
      break;
    default:
      instructions.push('npm install');
  }
  instructions.push('```');
  instructions.push('');
  
  // Environment variables setup
  if (integrations.length > 0) {
    instructions.push('## 2. Configure environment variables');
    instructions.push('');
    instructions.push('Create a `.env.local` file with the following variables:');
    instructions.push('');
    instructions.push('```env');
    
    for (const integrationId of integrations) {
      const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
      if (integration) {
        instructions.push(`# ${integration.name}`);
        for (const envVar of integration.requiredEnvVars) {
          instructions.push(`${envVar.name}=${envVar.example}`);
        }
        instructions.push('');
      }
    }
    
    instructions.push('```');
    instructions.push('');
  }
  
  // Integration-specific setup
  instructions.push('## 3. Integration Setup');
  instructions.push('');
  
  for (const integrationId of integrations) {
    const integration = AVAILABLE_INTEGRATIONS.find(i => i.id === integrationId);
    if (integration) {
      instructions.push(`### ${integration.name}`);
      instructions.push('');
      
      switch (integrationId) {
        case 'clerk':
          instructions.push('1. Create a Clerk application at https://clerk.com');
          instructions.push('2. Copy your publishable and secret keys');
          instructions.push('3. Configure OAuth providers if needed');
          break;
        case 'stripe':
          instructions.push('1. Create a Stripe account at https://stripe.com');
          instructions.push('2. Get your API keys from the dashboard');
          instructions.push('3. Set up webhook endpoint for `/api/webhooks/stripe`');
          break;
        case 'turso':
          instructions.push('1. Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`');
          instructions.push('2. Create a database: `turso db create ${projectName}`');
          instructions.push('3. Get your database URL and auth token');
          break;
        case 'supabase':
          instructions.push('1. Create a Supabase project at https://supabase.com');
          instructions.push('2. Copy your project URL and anon key');
          instructions.push('3. Set up database schema and RLS policies');
          break;
        case 'sentry':
          instructions.push('1. Create a Sentry project at https://sentry.io');
          instructions.push('2. Copy your DSN from project settings');
          instructions.push('3. Configure source maps upload if needed');
          break;
        case 'resend':
          instructions.push('1. Sign up for Resend at https://resend.com');
          instructions.push('2. Generate an API key');
          instructions.push('3. Verify your sending domain');
          break;
        case 'posthog':
          instructions.push('1. Create a PostHog project at https://posthog.com');
          instructions.push('2. Copy your project API key');
          instructions.push('3. Configure feature flags if needed');
          break;
        case 'uploadthing':
          instructions.push('1. Create an UploadThing app at https://uploadthing.com');
          instructions.push('2. Copy your secret key and app ID');
          instructions.push('3. Configure file type restrictions');
          break;
      }
      
      instructions.push('');
    }
  }
  
  // Run the development server
  instructions.push('## 4. Start development server');
  instructions.push('');
  instructions.push('```bash');
  switch (packageManager) {
    case 'yarn':
      instructions.push('yarn dev');
      break;
    case 'pnpm':
      instructions.push('pnpm dev');
      break;
    case 'bun':
      instructions.push('bun dev');
      break;
    default:
      instructions.push('npm run dev');
  }
  instructions.push('```');
  
  return instructions.join('\n');
}