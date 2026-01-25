import type {
  ProvisioningContext,
  ProvisioningStep,
  ProvisioningResult,
  ProvisioningOutcome,
  ProvisionerConfig,
} from './types';
import { createNeonProvisioner } from './neon';
import { createVercelProvisioner } from './vercel';

export class ProvisioningOrchestrator {
  private steps: ProvisioningStep[] = [];
  private config: ProvisionerConfig;

  constructor(config: ProvisionerConfig) {
    this.config = config;
    this.initializeProvisioningSteps();
  }

  private initializeProvisioningSteps(): void {
    if (this.config.neon?.apiKey) {
      const neonProvisioner = createNeonProvisioner(this.config.neon.apiKey);
      this.steps.push(neonProvisioner.createProvisioningStep());
    }

    if (this.config.vercel?.token) {
      const vercelProvisioner = createVercelProvisioner(
        this.config.vercel.token,
        this.config.vercel.teamId
      );
      this.steps.push(vercelProvisioner.createProvisioningStep());
    }
  }

  async provision(context: ProvisioningContext): Promise<ProvisioningOutcome> {
    const results: ProvisioningResult[] = [];
    const credentials: Record<string, string> = {};
    const errors: string[] = [];
    const completedSteps: Array<{ step: ProvisioningStep; result: ProvisioningResult }> = [];

    for (const step of this.steps) {
      if (!step.shouldRun(context)) {
        results.push({
          provider: step.provider,
          resourceType: 'unknown',
          status: 'skipped',
          message: `Skipped: ${step.name}`,
        });
        continue;
      }

      try {
        const result = await step.execute(context);
        results.push(result);

        if (result.status === 'success') {
          completedSteps.push({ step, result });
          if (result.credentials) {
            Object.assign(credentials, result.credentials);
          }
        } else if (result.status === 'failed') {
          errors.push(result.error ?? `${step.name} failed`);
          await this.rollback(completedSteps, context);
          
          return {
            success: false,
            results,
            credentials: {},
            errors,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${step.name}: ${errorMessage}`);
        results.push({
          provider: step.provider,
          resourceType: 'unknown',
          status: 'failed',
          error: errorMessage,
        });

        await this.rollback(completedSteps, context);

        return {
          success: false,
          results,
          credentials: {},
          errors,
        };
      }
    }

    return {
      success: errors.length === 0,
      results,
      credentials,
      errors,
    };
  }

  private async rollback(
    completedSteps: Array<{ step: ProvisioningStep; result: ProvisioningResult }>,
    context: ProvisioningContext
  ): Promise<void> {
    for (const { step, result } of completedSteps.reverse()) {
      if (step.rollback) {
        try {
          await step.rollback(context, result);
        } catch {
          // Rollback errors are logged but don't stop the process
        }
      }
    }
  }

  addStep(step: ProvisioningStep): void {
    this.steps.push(step);
  }

  getAvailableProviders(): string[] {
    return this.steps.map(s => s.provider);
  }
}

export function createProvisioningOrchestrator(config?: ProvisionerConfig): ProvisioningOrchestrator {
  const effectiveConfig: ProvisionerConfig = config ?? {
    neon: process.env.NEON_API_KEY ? { apiKey: process.env.NEON_API_KEY } : undefined,
    vercel: process.env.VERCEL_TOKEN ? { 
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
    } : undefined,
  };

  return new ProvisioningOrchestrator(effectiveConfig);
}
