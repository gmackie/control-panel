import { NextRequest, NextResponse } from "next/server";
import { QuickStartConfig, QUICK_START_TEMPLATES } from "@/types/starter-app";

export async function POST(request: NextRequest) {
  try {
    const config: QuickStartConfig = await request.json();

    // Validate config
    if (!config.projectName || !/^[a-z][a-z0-9-]*$/.test(config.projectName)) {
      return NextResponse.json(
        { error: "Invalid project name. Must start with a letter and contain only lowercase letters, numbers, and hyphens." },
        { status: 400 }
      );
    }

    const template = QUICK_START_TEMPLATES.find((t) => t.id === config.templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Generate commands based on configuration
    const commands = generateCommands(config, template);
    const nextSteps = generateNextSteps(config);

    return NextResponse.json({
      success: true,
      commands,
      nextSteps,
      template: {
        id: template.id,
        name: template.name,
        repoUrl: template.repoUrl,
      },
    });
  } catch (error) {
    console.error("Error generating quick-start project:", error);
    return NextResponse.json(
      { error: "Failed to generate project configuration" },
      { status: 500 }
    );
  }
}

function generateCommands(
  config: QuickStartConfig,
  template: typeof QUICK_START_TEMPLATES[0]
): string[] {
  const commands: string[] = [];

  // Clone the template
  commands.push(`git clone ${template.repoUrl} ${config.projectName}`);
  commands.push(`cd ${config.projectName}`);

  // Run setup script with appropriate flags
  let setupCmd = `./scripts/setup.sh ${config.projectName}`;
  if (!config.includeMobile) {
    setupCmd += " --no-mobile";
  }
  commands.push(setupCmd);

  // Optionally run provisioning
  if (config.autoProvision) {
    commands.push("./scripts/provision.sh");
  }

  // Start development
  commands.push("pnpm dev");

  return commands;
}

function generateNextSteps(config: QuickStartConfig): string[] {
  const steps: string[] = [];

  steps.push("Run the commands above to create and set up your project");

  if (config.autoProvision) {
    steps.push("The provisioning script will guide you through setting up Neon, Clerk, Stripe, PostHog, and Sentry");
  } else {
    steps.push("Copy .env.example to .env.local and fill in your API keys");
  }

  steps.push("Push to GitHub and connect to Vercel for automatic deployments");

  if (config.includeMobile) {
    steps.push("For mobile, run 'pnpm --filter @" + config.projectName + "/mobile start' to launch Expo");
  }

  steps.push("Check the README.md for detailed documentation on the template structure");

  return steps;
}
