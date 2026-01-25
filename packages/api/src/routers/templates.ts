import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { applications, eq } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { createTemplateEngine } from "../lib/templates";
import type { 
  TemplateSource, 
  RegisteredTemplate,
  TemplateMetadata,
  ProvisioningStepResult,
} from "../lib/templates/types";
import { getProviderRegistry } from "../providers/registry";
import { createProvisioningOrchestrator } from "../lib/provisioning";
import { randomUUID } from "crypto";

const REGISTERED_TEMPLATES: RegisteredTemplate[] = [
  {
    id: "vercel-neon-expo",
    name: "Vercel + Neon + Expo Template",
    description: "Full-stack template with Next.js web app, Expo mobile app, tRPC API, and Neon PostgreSQL database",
    version: "1.0.0",
    source: {
      type: "local",
      url: "/Volumes/dev/vercel-neon-expo-template",
    },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

const gitProviderSchema = z.enum(["github", "gitea", "gitlab"]);
const deployProviderSchema = z.enum(["vercel", "kubernetes", "railway", "flyio"]);
const dbProviderSchema = z.enum(["neon", "turso", "supabase", "planetscale"]);

export const templatesRouter = router({
  list: publicProcedure.query(async () => {
    const engine = createTemplateEngine();
    
    const templates = await Promise.all(
      REGISTERED_TEMPLATES.map(async (template) => {
        try {
          const metadata = await engine.loadTemplateMetadata(template.source);
          return {
            ...template,
            metadata: {
              features: metadata.config.features,
              supportedProviders: metadata.config.supportedProviders,
              defaultIntegrations: metadata.config.defaultIntegrations,
              optionalIntegrations: metadata.config.optionalIntegrations,
              integrationCount: metadata.integrations.length,
            },
          };
        } catch {
          return {
            ...template,
            metadata: null,
          };
        }
      })
    );

    return templates;
  }),

  byId: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const template = REGISTERED_TEMPLATES.find((t) => t.id === input);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      const engine = createTemplateEngine();
      let metadata: TemplateMetadata | null = null;

      try {
        metadata = await engine.loadTemplateMetadata(template.source);
      } catch {
        // Template metadata not available
      }

      return {
        ...template,
        metadata,
      };
    }),

  getMetadata: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const template = REGISTERED_TEMPLATES.find((t) => t.id === input);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      const engine = createTemplateEngine();
      const metadata = await engine.loadTemplateMetadata(template.source);
      return metadata;
    }),

  instantiate: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        appName: z.string().min(1).max(100),
        appSlug: z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/),
        description: z.string().optional(),
        modules: z.array(z.string()),
        gitProvider: gitProviderSchema,
        deployProvider: deployProviderSchema,
        dbProvider: dbProviderSchema,
        repoVisibility: z.enum(["public", "private"]).default("private"),
        autoProvision: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const template = REGISTERED_TEMPLATES.find((t) => t.id === input.templateId);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      const existingApp = await ctx.db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.slug, input.appSlug))
        .limit(1);

      if (existingApp.length > 0) {
        throw new TRPCError({ 
          code: "CONFLICT", 
          message: `Application with slug "${input.appSlug}" already exists` 
        });
      }

      const engine = createTemplateEngine();
      const metadata = await engine.loadTemplateMetadata(template.source);
      const allSteps: ProvisioningStepResult[] = [];

      const { localPath, steps: instantiateSteps } = await engine.instantiate(
        template.source,
        {
          templateId: input.templateId,
          appName: input.appName,
          appSlug: input.appSlug,
          description: input.description,
          modules: input.modules,
          gitProvider: input.gitProvider,
          deployProvider: input.deployProvider,
          dbProvider: input.dbProvider,
        },
        metadata
      );
      allSteps.push(...instantiateSteps);

      await engine.initGitRepo(localPath);
      allSteps.push({
        step: "git_init",
        provider: "local",
        status: "success",
        message: "Git repository initialized",
      });

      let repositoryUrl = "";
      const registry = getProviderRegistry();

      if (registry.hasGitProvider(input.gitProvider)) {
        try {
          const gitProvider = registry.getGitProvider(input.gitProvider);
          const repo = await gitProvider.createRepo({
            name: input.appSlug,
            description: input.description ?? `${input.appName} - Created from template`,
            isPrivate: input.repoVisibility === "private",
          });
          repositoryUrl = repo.cloneUrl;

          allSteps.push({
            step: "create_repo",
            provider: input.gitProvider,
            status: "success",
            message: `Repository created: ${repo.fullName}`,
            resourceId: repo.id,
          });
        } catch (error) {
          allSteps.push({
            step: "create_repo",
            provider: input.gitProvider,
            status: "failed",
            message: `Failed to create repository: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      } else {
        allSteps.push({
          step: "create_repo",
          provider: input.gitProvider,
          status: "skipped",
          message: `Git provider ${input.gitProvider} not configured`,
        });
      }

      const appId = randomUUID();
      const now = new Date();

      await ctx.db.insert(applications).values({
        id: appId,
        name: input.appName,
        slug: input.appSlug,
        description: input.description ?? null,
        repositoryUrl: repositoryUrl || null,
        gitProvider: input.gitProvider,
        deployProvider: input.deployProvider,
        dbProvider: input.dbProvider,
        status: "active",
        appType: "fullstack",
        createdAt: now,
        updatedAt: now,
      });

      allSteps.push({
        step: "create_application",
        provider: "control_panel",
        status: "success",
        message: `Application "${input.appName}" created`,
        resourceId: appId,
      });

      let provisionedCredentials: Record<string, string> = {};

      if (input.autoProvision) {
        const orchestrator = createProvisioningOrchestrator();
        const provisioningResult = await orchestrator.provision({
          applicationId: appId,
          applicationName: input.appName,
          applicationSlug: input.appSlug,
          gitProvider: input.gitProvider,
          deployProvider: input.deployProvider,
          dbProvider: input.dbProvider,
          modules: input.modules,
          repositoryUrl,
        });

        for (const result of provisioningResult.results) {
          allSteps.push({
            step: `provision_${result.provider}`,
            provider: result.provider,
            status: result.status,
            message: result.message ?? result.error,
            resourceId: result.resourceId,
          });
        }

        provisionedCredentials = provisioningResult.credentials;
      }

      const nextSteps: string[] = [];
      
      if (!repositoryUrl) {
        nextSteps.push(`Create a Git repository and push the code from: ${localPath}`);
      } else {
        nextSteps.push(`Clone your new repository: git clone ${repositoryUrl}`);
      }

      const requiredEnvVars = input.modules.flatMap((moduleId) => {
        const module = metadata.integrations.find((i) => i.id === moduleId);
        if (!module?.envVars.required) return [];
        return Object.keys(module.envVars.required);
      });

      const unprovisionedEnvVars = requiredEnvVars.filter(
        (key) => !provisionedCredentials[key]
      );

      if (unprovisionedEnvVars.length > 0) {
        nextSteps.push(`Set up environment variables: ${unprovisionedEnvVars.join(", ")}`);
      }

      nextSteps.push("Run `pnpm install` to install dependencies");
      nextSteps.push("Run `pnpm dev` to start development server");

      if (repositoryUrl) {
        await engine.cleanup(localPath);
      }

      return {
        success: true,
        applicationId: appId,
        repositoryUrl,
        localPath: repositoryUrl ? undefined : localPath,
        provisioningStatus: allSteps,
        nextSteps,
      };
    }),

  validateSlug: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        return { valid: true, available: true };
      }

      const slugRegex = /^[a-z][a-z0-9-]*$/;
      if (!slugRegex.test(input)) {
        return {
          valid: false,
          available: false,
          error: "Slug must start with a letter and contain only lowercase letters, numbers, and hyphens",
        };
      }

      if (input.length < 2 || input.length > 50) {
        return {
          valid: false,
          available: false,
          error: "Slug must be between 2 and 50 characters",
        };
      }

      const existing = await ctx.db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.slug, input))
        .limit(1);

      return {
        valid: true,
        available: existing.length === 0,
        error: existing.length > 0 ? "This slug is already taken" : undefined,
      };
    }),
});
