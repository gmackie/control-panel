/**
 * Applications Repository
 * 
 * Database operations for applications
 */

import { eq, desc, and, like, sql } from "drizzle-orm";
import { getPostgresDb } from "../postgres";
import {
  applications,
  applicationSecrets,
  applicationIntegrations,
  Application,
  NewApplication,
} from "../../schema-pg";

export class ApplicationsRepository {
  // ==========================================
  // Application CRUD
  // ==========================================

  /**
   * Get all applications
   */
  async getAll(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
  }): Promise<Application[]> {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db.select().from(applications);

    if (options?.search) {
      query = query.where(
        like(applications.name, `%${options.search}%`)
      );
    }

    if (options?.status) {
      query = query.where(eq(applications.status, options.status));
    }

    query = query.orderBy(desc(applications.updatedAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  /**
   * Get application by ID
   */
  async getById(id: string): Promise<Application | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get application by slug
   */
  async getBySlug(slug: string): Promise<Application | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(applications)
      .where(eq(applications.slug, slug))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get application by repository full name (owner/repo)
   */
  async getByRepository(fullName: string): Promise<Application | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(applications)
      .where(eq(applications.repositoryFullName, fullName))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Create new application
   */
  async create(data: NewApplication): Promise<Application> {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(applications)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update application
   */
  async update(id: string, data: Partial<NewApplication>): Promise<Application | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .update(applications)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Delete application
   */
  async delete(id: string): Promise<boolean> {
    const db = await getPostgresDb();
    if (!db) return false;

    const result = await db
      .delete(applications)
      .where(eq(applications.id, id));

    return true;
  }

  /**
   * Update application status
   */
  async updateStatus(id: string, status: string): Promise<Application | null> {
    return this.update(id, { status });
  }

  // ==========================================
  // Application Secrets
  // ==========================================

  /**
   * Get secrets for an application
   */
  async getSecrets(applicationId: string, environment?: string) {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(applicationSecrets)
      .where(eq(applicationSecrets.applicationId, applicationId));

    if (environment) {
      query = query.where(
        and(
          eq(applicationSecrets.applicationId, applicationId),
          eq(applicationSecrets.environment, environment)
        )
      );
    }

    return query.orderBy(applicationSecrets.name);
  }

  /**
   * Get a single secret by name and environment
   */
  async getSecret(applicationId: string, name: string, environment: string = "all") {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(applicationSecrets)
      .where(
        and(
          eq(applicationSecrets.applicationId, applicationId),
          eq(applicationSecrets.name, name),
          eq(applicationSecrets.environment, environment)
        )
      )
      .limit(1);

    return results[0] || null;
  }

  /**
   * Create or update a secret
   */
  async upsertSecret(data: {
    applicationId: string;
    name: string;
    encryptedValue: string;
    iv: string;
    environment?: string;
    description?: string;
    createdBy?: string;
  }) {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const environment = data.environment || "all";

    // Check if secret exists
    const existing = await this.getSecret(data.applicationId, data.name, environment);

    if (existing) {
      // Update
      const results = await db
        .update(applicationSecrets)
        .set({
          encryptedValue: data.encryptedValue,
          iv: data.iv,
          description: data.description,
          updatedBy: data.createdBy,
          updatedAt: new Date(),
        })
        .where(eq(applicationSecrets.id, existing.id))
        .returning();

      return results[0];
    } else {
      // Insert
      const results = await db
        .insert(applicationSecrets)
        .values({
          applicationId: data.applicationId,
          name: data.name,
          encryptedValue: data.encryptedValue,
          iv: data.iv,
          environment,
          description: data.description,
          createdBy: data.createdBy,
        })
        .returning();

      return results[0];
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(applicationId: string, name: string, environment: string = "all") {
    const db = await getPostgresDb();
    if (!db) return false;

    await db
      .delete(applicationSecrets)
      .where(
        and(
          eq(applicationSecrets.applicationId, applicationId),
          eq(applicationSecrets.name, name),
          eq(applicationSecrets.environment, environment)
        )
      );

    return true;
  }

  // ==========================================
  // Application Integrations
  // ==========================================

  /**
   * Get integrations for an application
   */
  async getIntegrations(applicationId: string) {
    const db = await getPostgresDb();
    if (!db) return [];

    return db
      .select()
      .from(applicationIntegrations)
      .where(eq(applicationIntegrations.applicationId, applicationId))
      .orderBy(applicationIntegrations.provider);
  }

  /**
   * Get integration by provider
   */
  async getIntegration(applicationId: string, provider: string) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(applicationIntegrations)
      .where(
        and(
          eq(applicationIntegrations.applicationId, applicationId),
          eq(applicationIntegrations.provider, provider)
        )
      )
      .limit(1);

    return results[0] || null;
  }

  /**
   * Upsert integration
   */
  async upsertIntegration(data: {
    applicationId: string;
    provider: string;
    name: string;
    status?: string;
    config?: Record<string, unknown>;
    healthStatus?: string;
  }) {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const existing = await this.getIntegration(data.applicationId, data.provider);

    if (existing) {
      const results = await db
        .update(applicationIntegrations)
        .set({
          name: data.name,
          status: data.status || existing.status,
          config: data.config || existing.config,
          healthStatus: data.healthStatus,
          updatedAt: new Date(),
        })
        .where(eq(applicationIntegrations.id, existing.id))
        .returning();

      return results[0];
    } else {
      const results = await db
        .insert(applicationIntegrations)
        .values({
          applicationId: data.applicationId,
          provider: data.provider,
          name: data.name,
          status: data.status || "active",
          config: data.config || {},
          healthStatus: data.healthStatus || "unknown",
        })
        .returning();

      return results[0];
    }
  }

  /**
   * Delete integration
   */
  async deleteIntegration(applicationId: string, provider: string) {
    const db = await getPostgresDb();
    if (!db) return false;

    await db
      .delete(applicationIntegrations)
      .where(
        and(
          eq(applicationIntegrations.applicationId, applicationId),
          eq(applicationIntegrations.provider, provider)
        )
      );

    return true;
  }

  /**
   * Update integration health status
   */
  async updateIntegrationHealth(
    applicationId: string,
    provider: string,
    healthStatus: string,
    healthMessage?: string
  ) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .update(applicationIntegrations)
      .set({
        healthStatus,
        healthMessage,
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(applicationIntegrations.applicationId, applicationId),
          eq(applicationIntegrations.provider, provider)
        )
      )
      .returning();

    return results[0] || null;
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get application count by status
   */
  async getCountByStatus() {
    const db = await getPostgresDb();
    if (!db) return {};

    const results = await db
      .select({
        status: applications.status,
        count: sql<number>`count(*)`,
      })
      .from(applications)
      .groupBy(applications.status);

    const counts: Record<string, number> = {};
    for (const row of results) {
      counts[row.status] = Number(row.count);
    }

    return counts;
  }

  /**
   * Get total application count
   */
  async getCount() {
    const db = await getPostgresDb();
    if (!db) return 0;

    const results = await db
      .select({ count: sql<number>`count(*)` })
      .from(applications);

    return Number(results[0]?.count || 0);
  }
}

// Export singleton instance
export const applicationsRepo = new ApplicationsRepository();
