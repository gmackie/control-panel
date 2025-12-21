/**
 * Deployments Repository
 * 
 * Database operations for deployments, pipeline runs, and environment status
 */

import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import { getPostgresDb } from "../postgres";
import {
  deployments,
  pipelineRuns,
  pipelineStages,
  environmentStatus,
  Deployment,
  NewDeployment,
  PipelineRun,
  NewPipelineRun,
} from "../../schema-pg";

export class DeploymentsRepository {
  // ==========================================
  // Deployments CRUD
  // ==========================================

  /**
   * Get all deployments for an application
   */
  async getByApplication(applicationId: string, options?: {
    limit?: number;
    offset?: number;
    environment?: string;
  }): Promise<Deployment[]> {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(deployments)
      .where(eq(deployments.applicationId, applicationId));

    if (options?.environment) {
      query = query.where(
        and(
          eq(deployments.applicationId, applicationId),
          eq(deployments.environment, options.environment)
        )
      );
    }

    query = query.orderBy(desc(deployments.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  /**
   * Get deployment by ID
   */
  async getById(id: string): Promise<Deployment | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get latest deployment for an application and environment
   */
  async getLatest(applicationId: string, environment: string): Promise<Deployment | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.applicationId, applicationId),
          eq(deployments.environment, environment)
        )
      )
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Create new deployment
   */
  async create(data: NewDeployment): Promise<Deployment> {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(deployments)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update deployment
   */
  async update(id: string, data: Partial<NewDeployment>): Promise<Deployment | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .update(deployments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Update deployment status
   */
  async updateStatus(
    id: string,
    status: string,
    healthCheckStatus?: string
  ): Promise<Deployment | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const updateData: Partial<NewDeployment> = { status };
    if (healthCheckStatus) {
      updateData.healthCheckStatus = healthCheckStatus;
    }
    if (status === "deployed") {
      updateData.deployedAt = new Date();
    }

    return this.update(id, updateData);
  }

  /**
   * Record deployment completion
   */
  async complete(
    id: string,
    status: "deployed" | "failed" | "rolled_back",
    readyReplicas?: number
  ): Promise<Deployment | null> {
    return this.update(id, {
      status,
      readyReplicas,
      deployedAt: new Date(),
    });
  }

  // ==========================================
  // Pipeline Runs
  // ==========================================

  /**
   * Get pipeline runs for an application
   */
  async getPipelineRuns(applicationId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    branch?: string;
  }): Promise<PipelineRun[]> {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.applicationId, applicationId));

    if (options?.status) {
      query = query.where(
        and(
          eq(pipelineRuns.applicationId, applicationId),
          eq(pipelineRuns.status, options.status)
        )
      );
    }

    if (options?.branch) {
      query = query.where(
        and(
          eq(pipelineRuns.applicationId, applicationId),
          eq(pipelineRuns.branch, options.branch)
        )
      );
    }

    query = query.orderBy(desc(pipelineRuns.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  /**
   * Get pipeline run by ID
   */
  async getPipelineRunById(id: string): Promise<PipelineRun | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get pipeline run by commit SHA
   */
  async getPipelineRunByCommit(commitId: string): Promise<PipelineRun | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.commitId, commitId))
      .orderBy(desc(pipelineRuns.createdAt))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Create pipeline run
   */
  async createPipelineRun(data: NewPipelineRun): Promise<PipelineRun> {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(pipelineRuns)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update pipeline run
   */
  async updatePipelineRun(
    id: string,
    data: Partial<NewPipelineRun>
  ): Promise<PipelineRun | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .update(pipelineRuns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(pipelineRuns.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Complete pipeline run
   */
  async completePipelineRun(
    id: string,
    status: string,
    conclusion: string,
    duration?: number
  ): Promise<PipelineRun | null> {
    return this.updatePipelineRun(id, {
      status,
      conclusion,
      duration,
      finishedAt: new Date(),
    });
  }

  // ==========================================
  // Pipeline Stages
  // ==========================================

  /**
   * Get stages for a pipeline run
   */
  async getPipelineStages(pipelineRunId: string) {
    const db = await getPostgresDb();
    if (!db) return [];

    return db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineRunId, pipelineRunId))
      .orderBy(pipelineStages.order);
  }

  /**
   * Create pipeline stage
   */
  async createPipelineStage(data: {
    pipelineRunId: string;
    name: string;
    status: string;
    order: number;
  }) {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(pipelineStages)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update pipeline stage
   */
  async updatePipelineStage(
    id: string,
    data: {
      status?: string;
      startedAt?: Date;
      finishedAt?: Date;
      duration?: number;
      logs?: string;
      errorMessage?: string;
    }
  ) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .update(pipelineStages)
      .set(data)
      .where(eq(pipelineStages.id, id))
      .returning();

    return results[0] || null;
  }

  // ==========================================
  // Environment Status
  // ==========================================

  /**
   * Get environment status for an application
   */
  async getEnvironmentStatus(applicationId: string, environment?: string) {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(environmentStatus)
      .where(eq(environmentStatus.applicationId, applicationId));

    if (environment) {
      query = query.where(
        and(
          eq(environmentStatus.applicationId, applicationId),
          eq(environmentStatus.environment, environment)
        )
      );
    }

    return query;
  }

  /**
   * Upsert environment status
   */
  async upsertEnvironmentStatus(data: {
    applicationId: string;
    environment: string;
    namespace: string;
    deploymentName: string;
    currentCommitSha?: string;
    currentImageTag?: string;
    currentVersion?: string;
    status: string;
    replicas?: number;
    readyReplicas?: number;
    url?: string;
    lastDeployedBy?: string;
  }) {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    // Check if exists
    const existing = await db
      .select()
      .from(environmentStatus)
      .where(
        and(
          eq(environmentStatus.applicationId, data.applicationId),
          eq(environmentStatus.environment, data.environment)
        )
      )
      .limit(1);

    if (existing[0]) {
      // Update
      const results = await db
        .update(environmentStatus)
        .set({
          ...data,
          lastDeployedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(environmentStatus.id, existing[0].id))
        .returning();

      return results[0];
    } else {
      // Insert
      const results = await db
        .insert(environmentStatus)
        .values({
          ...data,
          lastDeployedAt: new Date(),
        })
        .returning();

      return results[0];
    }
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get deployment count by status for an application
   */
  async getDeploymentCountByStatus(applicationId: string) {
    const db = await getPostgresDb();
    if (!db) return {};

    const results = await db
      .select({
        status: deployments.status,
        count: sql<number>`count(*)`,
      })
      .from(deployments)
      .where(eq(deployments.applicationId, applicationId))
      .groupBy(deployments.status);

    const counts: Record<string, number> = {};
    for (const row of results) {
      counts[row.status] = Number(row.count);
    }

    return counts;
  }

  /**
   * Get pipeline success rate for an application
   */
  async getPipelineSuccessRate(applicationId: string, days: number = 30) {
    const db = await getPostgresDb();
    if (!db) return { total: 0, successful: 0, rate: 0 };

    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await db
      .select({
        total: sql<number>`count(*)`,
        successful: sql<number>`count(*) filter (where ${pipelineRuns.conclusion} = 'success')`,
      })
      .from(pipelineRuns)
      .where(
        and(
          eq(pipelineRuns.applicationId, applicationId),
          gte(pipelineRuns.createdAt, since)
        )
      );

    const total = Number(results[0]?.total || 0);
    const successful = Number(results[0]?.successful || 0);
    const rate = total > 0 ? (successful / total) * 100 : 0;

    return { total, successful, rate };
  }

  /**
   * Get recent deployments across all applications
   */
  async getRecentDeployments(limit: number = 10) {
    const db = await getPostgresDb();
    if (!db) return [];

    return db
      .select()
      .from(deployments)
      .orderBy(desc(deployments.createdAt))
      .limit(limit);
  }

  /**
   * Get deployments in a time range
   */
  async getDeploymentsInRange(
    applicationId: string,
    startDate: Date,
    endDate: Date
  ) {
    const db = await getPostgresDb();
    if (!db) return [];

    return db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.applicationId, applicationId),
          gte(deployments.createdAt, startDate),
          lte(deployments.createdAt, endDate)
        )
      )
      .orderBy(desc(deployments.createdAt));
  }
}

// Export singleton instance
export const deploymentsRepo = new DeploymentsRepository();
