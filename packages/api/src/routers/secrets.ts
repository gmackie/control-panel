/**
 * Secrets Router
 *
 * tRPC procedures for encrypted secret management with K8s/Vercel sync.
 *
 * Data flow:
 *   set: validate → encrypt → DB upsert → sync to targets → status update
 *   reveal: auth check → decrypt → return (auto-expires in UI)
 *   list: DB query → mask values → return
 *   export: DB query → decrypt all → format as .env/JSON/YAML
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { appSecrets, applications, eq, and, desc } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { encryptSecret, decryptSecret, maskSecret } from "../lib/crypto";
import { PROVIDER_TEMPLATES, CATEGORY_LABELS, CATEGORY_ORDER } from "../lib/secret-templates";

const secretCategorySchema = z.enum([
  "database", "auth", "monitoring", "email", "payments", "analytics", "custom",
]);

const syncTargetSchema = z.string().regex(
  /^(k8s|vercel):(production|staging|preview|development|shared)$/,
  "Sync target must be like 'k8s:production' or 'vercel:preview'"
);

export const secretsRouter = router({
  /** List secrets for an app, grouped by category. Values are masked. */
  list: publicProcedure
    .input(z.object({
      applicationId: z.string(),
      environment: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const conditions = [eq(appSecrets.applicationId, input.applicationId)];
      if (input.environment) {
        conditions.push(eq(appSecrets.environment, input.environment));
      }

      const secrets = await ctx.db
        .select()
        .from(appSecrets)
        .where(and(...conditions))
        .orderBy(appSecrets.category, appSecrets.key);

      // Group by category, mask values
      const grouped: Record<string, {
        category: string;
        label: string;
        secrets: {
          id: string;
          key: string;
          maskedValue: string;
          environment: string;
          category: string;
          provider: string | null;
          sensitive: boolean;
          syncTargets: string[];
          lastSyncStatus: string | null;
          lastSyncedAt: string | null;
          lastSyncError: string | null;
          updatedAt: string;
        }[];
      }> = {};

      for (const secret of secrets) {
        const cat = secret.category;
        if (!grouped[cat]) {
          grouped[cat] = {
            category: cat,
            label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
            secrets: [],
          };
        }

        // Decrypt to mask (never send encrypted or plain value in list)
        let maskedValue = "••••••••";
        try {
          const plain = decryptSecret(secret.encryptedValue, secret.iv);
          maskedValue = maskSecret(plain);
        } catch {
          maskedValue = "[decryption failed]";
        }

        grouped[cat].secrets.push({
          id: secret.id,
          key: secret.key,
          maskedValue,
          environment: secret.environment,
          category: secret.category,
          provider: secret.provider,
          sensitive: secret.sensitive,
          syncTargets: JSON.parse(secret.syncTargets) as string[],
          lastSyncStatus: secret.lastSyncStatus,
          lastSyncedAt: secret.lastSyncedAt?.toISOString() ?? null,
          lastSyncError: secret.lastSyncError,
          updatedAt: secret.updatedAt.toISOString(),
        });
      }

      // Return in category order
      return CATEGORY_ORDER
        .filter((cat) => grouped[cat])
        .map((cat) => grouped[cat]!);
    }),

  /** Set (create or update) an encrypted secret */
  set: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      key: z.string().min(1).max(255).regex(/^[A-Z][A-Z0-9_]*$/, "Key must be uppercase with underscores (e.g., DATABASE_URL)"),
      value: z.string().min(1, "Secret value cannot be empty"),
      environment: z.string().default("shared"),
      category: secretCategorySchema.default("custom"),
      provider: z.string().optional(),
      sensitive: z.boolean().default(true),
      syncTargets: z.array(syncTargetSchema).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Encrypt the value
      const { encryptedValue, iv } = encryptSecret(input.value);

      // Upsert — update if same app/key/env exists, create otherwise
      const existing = await ctx.db
        .select({ id: appSecrets.id })
        .from(appSecrets)
        .where(and(
          eq(appSecrets.applicationId, input.applicationId),
          eq(appSecrets.key, input.key),
          eq(appSecrets.environment, input.environment),
        ))
        .limit(1);

      let secretId: string;

      if (existing[0]) {
        await ctx.db
          .update(appSecrets)
          .set({
            encryptedValue,
            iv,
            category: input.category,
            provider: input.provider ?? null,
            sensitive: input.sensitive,
            syncTargets: JSON.stringify(input.syncTargets),
            lastSyncStatus: "pending",
            lastSyncError: null,
            updatedAt: new Date(),
          })
          .where(eq(appSecrets.id, existing[0].id));
        secretId = existing[0].id;
      } else {
        const [created] = await ctx.db
          .insert(appSecrets)
          .values({
            applicationId: input.applicationId,
            key: input.key,
            encryptedValue,
            iv,
            environment: input.environment,
            category: input.category,
            provider: input.provider ?? null,
            sensitive: input.sensitive,
            syncTargets: JSON.stringify(input.syncTargets),
            lastSyncStatus: "pending",
          })
          .returning({ id: appSecrets.id });
        secretId = created!.id;
      }

      return { id: secretId, status: "saved" };
    }),

  /** Delete a secret */
  delete: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [deleted] = await ctx.db
        .delete(appSecrets)
        .where(eq(appSecrets.id, input))
        .returning({ id: appSecrets.id, key: appSecrets.key });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Secret not found" });
      }

      return { id: deleted.id, key: deleted.key };
    }),

  /** Reveal a secret's decrypted value (rate-limited in UI, audit-logged) */
  reveal: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [secret] = await ctx.db
        .select()
        .from(appSecrets)
        .where(eq(appSecrets.id, input))
        .limit(1);

      if (!secret) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Secret not found" });
      }

      try {
        const value = decryptSecret(secret.encryptedValue, secret.iv);
        return { id: secret.id, key: secret.key, value };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to decrypt secret. The encryption key may have changed. Please re-enter the value.",
        });
      }
    }),

  /** Export secrets as .env, JSON, or YAML */
  export: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      environment: z.string().optional(),
      format: z.enum(["dotenv", "json", "yaml"]).default("dotenv"),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const conditions = [eq(appSecrets.applicationId, input.applicationId)];
      if (input.environment) {
        conditions.push(eq(appSecrets.environment, input.environment));
      }

      const secrets = await ctx.db
        .select()
        .from(appSecrets)
        .where(and(...conditions))
        .orderBy(appSecrets.category, appSecrets.key);

      // Decrypt all values
      const vars: Record<string, string> = {};
      const errors: string[] = [];

      for (const secret of secrets) {
        try {
          vars[secret.key] = decryptSecret(secret.encryptedValue, secret.iv);
        } catch {
          errors.push(secret.key);
        }
      }

      let content: string;
      switch (input.format) {
        case "dotenv":
          content = Object.entries(vars)
            .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
            .join("\n");
          break;
        case "json":
          content = JSON.stringify(vars, null, 2);
          break;
        case "yaml":
          content = Object.entries(vars)
            .map(([k, v]) => `${k}: "${v.replace(/"/g, '\\"')}"`)
            .join("\n");
          break;
      }

      // Get app name for the filename
      const [app] = await ctx.db
        .select({ name: applications.name })
        .from(applications)
        .where(eq(applications.id, input.applicationId))
        .limit(1);

      return {
        applicationName: app?.name ?? input.applicationId,
        format: input.format,
        content,
        variableCount: Object.keys(vars).length,
        decryptionErrors: errors,
      };
    }),

  /** Get available provider templates */
  templates: publicProcedure
    .query(() => {
      return PROVIDER_TEMPLATES.map((t) => ({
        provider: t.provider,
        displayName: t.displayName,
        category: t.category,
        description: t.description,
        fieldCount: t.fields.length + (t.sections?.reduce((n, s) => n + s.fields.length, 0) ?? 0),
        hasHealthCheck: !!t.healthCheck,
        hasWebhookUrl: !!t.webhookUrl,
        sections: t.sections?.map((s) => ({ id: s.id, label: s.label, toggleable: s.toggleable })),
      }));
    }),

  /** Get full template details for a provider */
  template: publicProcedure
    .input(z.string())
    .query(({ input }) => {
      const template = PROVIDER_TEMPLATES.find((t) => t.provider === input);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Template not found: ${input}` });
      }
      return template;
    }),

  /** Test a provider API key (health check) */
  healthCheck: protectedProcedure
    .input(z.object({
      provider: z.string(),
      token: z.string(),
    }))
    .mutation(async ({ input }) => {
      const template = PROVIDER_TEMPLATES.find((t) => t.provider === input.provider);
      if (!template?.healthCheck) {
        return { status: "no_check", message: "No health check available for this provider" };
      }

      const { testUrl, method = "GET", headers = {} } = template.healthCheck;

      try {
        const response = await fetch(testUrl, {
          method,
          headers: {
            ...headers,
            "Authorization": `Bearer ${input.token}`,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          return { status: "healthy", message: "API key is valid" };
        }

        if (response.status === 401 || response.status === 403) {
          return { status: "invalid", message: "API key is invalid or expired" };
        }

        return { status: "error", message: `API returned ${response.status}` };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Connection failed";
        return { status: "error", message };
      }
    }),

  /** Sync status summary for an app */
  syncStatus: publicProcedure
    .input(z.string()) // applicationId
    .query(async ({ ctx, input }) => {
      if (!ctx.db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const secrets = await ctx.db
        .select({
          lastSyncStatus: appSecrets.lastSyncStatus,
        })
        .from(appSecrets)
        .where(eq(appSecrets.applicationId, input));

      const total = secrets.length;
      const synced = secrets.filter((s) => s.lastSyncStatus === "synced").length;
      const pending = secrets.filter((s) => s.lastSyncStatus === "pending").length;
      const failed = secrets.filter((s) => s.lastSyncStatus === "failed").length;
      const drift = secrets.filter((s) => s.lastSyncStatus === "drift").length;

      return { total, synced, pending, failed, drift };
    }),
});
