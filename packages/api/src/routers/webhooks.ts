/**
 * Webhooks Router
 * 
 * tRPC procedures for webhook configuration and management.
 * Handles webhook URL generation, secret management, and testing.
 */

import { z } from "zod";
import crypto from "crypto";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { 
  taskSyncConfigs, 
  applications,
  eq, 
  and,
} from "@repo/db";
import { TRPCError } from "@trpc/server";

const webhookProviderSchema = z.enum(['github', 'gitea', 'task', 'notion']);

/**
 * Generate a random webhook secret
 */
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the base URL for webhooks from environment or request
 */
function getWebhookBaseUrl(): string {
  // In production, use NEXTAUTH_URL or a dedicated WEBHOOK_BASE_URL
  const baseUrl = process.env.WEBHOOK_BASE_URL || 
                  process.env.NEXTAUTH_URL || 
                  'http://localhost:3000';
  return baseUrl.replace(/\/$/, ''); // Remove trailing slash
}

export const webhooksRouter = router({
  /**
   * Get webhook URLs for all providers
   */
  getUrls: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid().optional(),
    }).optional())
    .query(async () => {
      const baseUrl = getWebhookBaseUrl();

      return {
        github: {
          url: `${baseUrl}/api/webhooks/github`,
          description: 'GitHub webhook endpoint for issues and releases',
          events: ['issues', 'release'],
          signatureHeader: 'X-Hub-Signature-256',
          configured: !!process.env.GITHUB_WEBHOOK_SECRET,
        },
        gitea: {
          url: `${baseUrl}/api/webhooks/gitea`,
          description: 'Gitea webhook endpoint for issues and releases',
          events: ['issues', 'release'],
          signatureHeader: 'X-Gitea-Signature',
          configured: !!process.env.GITEA_WEBHOOK_SECRET,
        },
        task: {
          url: `${baseUrl}/api/webhooks/task`,
          description: 'Task.gmac.io webhook endpoint for issues',
          events: ['Issue'],
          signatureHeader: 'X-Task-Signature',
          configured: !!process.env.TASK_WEBHOOK_SECRET,
        },
        notion: {
          url: `${baseUrl}/api/webhooks/notion`,
          description: 'Notion webhook endpoint for database updates',
          events: ['page.created', 'page.updated', 'database.updated'],
          signatureHeader: 'X-Notion-Signature',
          configured: !!process.env.NOTION_WEBHOOK_SECRET,
        },
      };
    }),

  /**
   * Get webhook URL for a specific provider
   */
  getUrl: publicProcedure
    .input(z.object({
      provider: webhookProviderSchema,
    }))
    .query(async ({ input }) => {
      const baseUrl = getWebhookBaseUrl();
      
      const providers: Record<string, { 
        url: string;
        events: string[];
        signatureHeader: string;
        configured: boolean;
      }> = {
        github: {
          url: `${baseUrl}/api/webhooks/github`,
          events: ['issues', 'release'],
          signatureHeader: 'X-Hub-Signature-256',
          configured: !!process.env.GITHUB_WEBHOOK_SECRET,
        },
        gitea: {
          url: `${baseUrl}/api/webhooks/gitea`,
          events: ['issues', 'release'],
          signatureHeader: 'X-Gitea-Signature',
          configured: !!process.env.GITEA_WEBHOOK_SECRET,
        },
        task: {
          url: `${baseUrl}/api/webhooks/task`,
          events: ['Issue'],
          signatureHeader: 'X-Task-Signature',
          configured: !!process.env.TASK_WEBHOOK_SECRET,
        },
        notion: {
          url: `${baseUrl}/api/webhooks/notion`,
          events: ['page.created', 'page.updated', 'database.updated'],
          signatureHeader: 'X-Notion-Signature',
          configured: !!process.env.NOTION_WEBHOOK_SECRET,
        },
      };

      return {
        provider: input.provider,
        ...providers[input.provider],
      };
    }),

  /**
   * Generate a new webhook secret (for configuration in external services)
   */
  generateSecret: protectedProcedure
    .mutation(async () => {
      const secret = generateWebhookSecret();
      return {
        secret,
        note: 'Store this secret securely. You will need to configure it in your environment variables and in the external service.',
      };
    }),

  /**
   * Check webhook configuration status for an application
   */
  getStatus: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get all sync configs for the app
      const configs = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(eq(taskSyncConfigs.applicationId, input.applicationId));

      const baseUrl = getWebhookBaseUrl();

      // Build status for each provider
      const status = configs.map(config => {
        const envSecretConfigured = (() => {
          switch (config.provider) {
            case 'github': return !!process.env.GITHUB_WEBHOOK_SECRET;
            case 'gitea': return !!process.env.GITEA_WEBHOOK_SECRET;
            case 'task': return !!process.env.TASK_WEBHOOK_SECRET;
            case 'notion': return !!process.env.NOTION_WEBHOOK_SECRET;
            default: return false;
          }
        })();

        return {
          provider: config.provider,
          enabled: config.enabled,
          webhookUrl: `${baseUrl}/api/webhooks/${config.provider}`,
          secretConfigured: envSecretConfigured,
          lastSyncAt: config.lastSyncAt,
          lastSyncStatus: config.lastSyncStatus,
          lastSyncError: config.lastSyncError,
        };
      });

      return {
        applicationId: input.applicationId,
        providers: status,
        allConfigured: status.every(s => s.secretConfigured && s.enabled),
      };
    }),

  /**
   * Test webhook endpoint (simulate a webhook delivery)
   */
  test: protectedProcedure
    .input(z.object({
      provider: webhookProviderSchema,
    }))
    .mutation(async ({ input }) => {
      const baseUrl = getWebhookBaseUrl();
      const webhookUrl = `${baseUrl}/api/webhooks/${input.provider}`;

      try {
        // Make a GET request to check the endpoint is alive
        const response = await fetch(webhookUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return {
            success: false,
            provider: input.provider,
            url: webhookUrl,
            error: `Endpoint returned status ${response.status}`,
          };
        }

        const data = await response.json() as { status?: string; configured?: boolean };

        return {
          success: true,
          provider: input.provider,
          url: webhookUrl,
          status: data.status || 'ok',
          configured: data.configured,
        };
      } catch (error) {
        return {
          success: false,
          provider: input.provider,
          url: webhookUrl,
          error: error instanceof Error ? error.message : 'Failed to reach webhook endpoint',
        };
      }
    }),

  /**
   * Get setup instructions for configuring webhooks
   */
  getSetupInstructions: publicProcedure
    .input(z.object({
      provider: webhookProviderSchema,
    }))
    .query(async ({ input }) => {
      const baseUrl = getWebhookBaseUrl();
      const webhookUrl = `${baseUrl}/api/webhooks/${input.provider}`;

      const instructions: Record<string, {
        title: string;
        steps: string[];
        events: string[];
        contentType: string;
        secretEnvVar: string;
      }> = {
        github: {
          title: 'GitHub Webhook Setup',
          steps: [
            `1. Go to your repository settings on GitHub`,
            `2. Navigate to Webhooks > Add webhook`,
            `3. Set Payload URL to: ${webhookUrl}`,
            `4. Set Content type to: application/json`,
            `5. Generate a secret and set it in the Secret field`,
            `6. Add the same secret to your environment as GITHUB_WEBHOOK_SECRET`,
            `7. Select "Let me select individual events"`,
            `8. Check "Issues" and "Releases"`,
            `9. Save the webhook`,
          ],
          events: ['issues', 'release'],
          contentType: 'application/json',
          secretEnvVar: 'GITHUB_WEBHOOK_SECRET',
        },
        gitea: {
          title: 'Gitea Webhook Setup',
          steps: [
            `1. Go to your repository settings in Gitea`,
            `2. Navigate to Webhooks > Add Webhook > Gitea`,
            `3. Set Target URL to: ${webhookUrl}`,
            `4. Set HTTP Method to: POST`,
            `5. Set POST Content Type to: application/json`,
            `6. Generate a secret and set it in the Secret field`,
            `7. Add the same secret to your environment as GITEA_WEBHOOK_SECRET`,
            `8. Select trigger events: Issues, Release`,
            `9. Save the webhook`,
          ],
          events: ['issues', 'release'],
          contentType: 'application/json',
          secretEnvVar: 'GITEA_WEBHOOK_SECRET',
        },
        task: {
          title: 'Task.gmac.io Webhook Setup',
          steps: [
            `1. Go to Task.gmac.io Settings > Webhooks`,
            `2. Click "Create new webhook"`,
            `3. Set URL to: ${webhookUrl}`,
            `4. Copy the signing secret shown`,
            `5. Add the signing secret to your environment as TASK_WEBHOOK_SECRET`,
            `6. Select data change events: Issue`,
            `7. Optionally filter by workspace if needed`,
            `8. Enable the webhook`,
          ],
          events: ['Issue'],
          contentType: 'application/json',
          secretEnvVar: 'TASK_WEBHOOK_SECRET',
        },
        notion: {
          title: 'Notion Webhook Setup',
          steps: [
            `1. Note: Notion doesn't have native webhooks. Use a service like Pipedream or Zapier`,
            `2. Create an automation that triggers on Notion database changes`,
            `3. Configure the automation to POST to: ${webhookUrl}`,
            `4. Set up a shared secret for HMAC verification`,
            `5. Add the secret to your environment as NOTION_WEBHOOK_SECRET`,
            `6. Configure the payload to include database_id and page data`,
          ],
          events: ['page.created', 'page.updated', 'database.updated'],
          contentType: 'application/json',
          secretEnvVar: 'NOTION_WEBHOOK_SECRET',
        },
      };

      return {
        provider: input.provider,
        webhookUrl,
        ...instructions[input.provider],
      };
    }),

  /**
   * Verify webhook configuration by checking environment variables
   */
  verifyConfig: protectedProcedure
    .query(async () => {
      const envVars = {
        github: 'GITHUB_WEBHOOK_SECRET',
        gitea: 'GITEA_WEBHOOK_SECRET',
        task: 'TASK_WEBHOOK_SECRET',
        notion: 'NOTION_WEBHOOK_SECRET',
      } as const;

      type Provider = keyof typeof envVars;
      const providers: Provider[] = ['github', 'gitea', 'task', 'notion'];

      const status = providers.map(provider => {
        const envVar = envVars[provider];
        return {
          provider,
          envVar,
          configured: !!process.env[envVar],
        };
      });

      return {
        providers: status,
        allConfigured: status.every(s => s.configured),
        missingSecrets: status.filter(s => !s.configured).map(s => s.envVar),
      };
    }),

  /**
   * Get webhook delivery history (from sync status)
   */
  getHistory: publicProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      provider: webhookProviderSchema.optional(),
      limit: z.number().min(1).max(100).optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get sync configs which track webhook-triggered syncs
      const conditions = [eq(taskSyncConfigs.applicationId, input.applicationId)];
      if (input.provider) {
        conditions.push(eq(taskSyncConfigs.provider, input.provider));
      }

      const configs = await ctx.db
        .select()
        .from(taskSyncConfigs)
        .where(and(...conditions));

      // Return the last sync info from configs
      // In a full implementation, we'd have a webhook_events table
      return configs
        .filter(c => c.lastSyncAt)
        .map(c => ({
          provider: c.provider,
          lastReceivedAt: c.lastSyncAt,
          status: c.lastSyncStatus,
          error: c.lastSyncError,
        }));
    }),
});
