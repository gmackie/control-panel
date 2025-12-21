/**
 * Commits Repository
 * 
 * Database operations for git commits and releases
 */

import { eq, desc, and, sql, gte, like } from "drizzle-orm";
import { getPostgresDb } from "../postgres";
import {
  commits,
  releases,
  activityLog,
  Commit,
  NewCommit,
} from "../../schema-pg";

export class CommitsRepository {
  // ==========================================
  // Commits CRUD
  // ==========================================

  /**
   * Get commits for an application
   */
  async getByApplication(applicationId: string, options?: {
    limit?: number;
    offset?: number;
    branch?: string;
  }): Promise<Commit[]> {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(commits)
      .where(eq(commits.applicationId, applicationId));

    if (options?.branch) {
      query = query.where(
        and(
          eq(commits.applicationId, applicationId),
          eq(commits.branch, options.branch)
        )
      );
    }

    query = query.orderBy(desc(commits.committedAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  /**
   * Get commit by SHA
   */
  async getBySha(sha: string): Promise<Commit | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(commits)
      .where(eq(commits.sha, sha))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get commit by ID
   */
  async getById(id: string): Promise<Commit | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(commits)
      .where(eq(commits.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get latest commit for an application
   */
  async getLatest(applicationId: string, branch?: string): Promise<Commit | null> {
    const db = await getPostgresDb();
    if (!db) return null;

    let query = db
      .select()
      .from(commits)
      .where(eq(commits.applicationId, applicationId));

    if (branch) {
      query = query.where(
        and(
          eq(commits.applicationId, applicationId),
          eq(commits.branch, branch)
        )
      );
    }

    const results = await query
      .orderBy(desc(commits.committedAt))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Create new commit
   */
  async create(data: NewCommit): Promise<Commit> {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    // Check if commit already exists
    const existing = await this.getBySha(data.sha);
    if (existing) {
      return existing;
    }

    const results = await db
      .insert(commits)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Bulk create commits
   */
  async createMany(data: NewCommit[]): Promise<Commit[]> {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    if (data.length === 0) return [];

    // Filter out existing commits
    const shas = data.map((c) => c.sha);
    const existing = await db
      .select({ sha: commits.sha })
      .from(commits)
      .where(sql`${commits.sha} = ANY(${shas})`);

    const existingShas = new Set(existing.map((e: { sha: string }) => e.sha));
    const newCommits = data.filter((c) => !existingShas.has(c.sha));

    if (newCommits.length === 0) return [];

    const results = await db
      .insert(commits)
      .values(newCommits)
      .returning();

    return results;
  }

  /**
   * Search commits by message
   */
  async search(applicationId: string, query: string, limit: number = 20) {
    const db = await getPostgresDb();
    if (!db) return [];

    return db
      .select()
      .from(commits)
      .where(
        and(
          eq(commits.applicationId, applicationId),
          like(commits.message, `%${query}%`)
        )
      )
      .orderBy(desc(commits.committedAt))
      .limit(limit);
  }

  // ==========================================
  // Releases
  // ==========================================

  /**
   * Get releases for an application
   */
  async getReleases(applicationId: string, options?: {
    limit?: number;
    includePrerelease?: boolean;
    includeDraft?: boolean;
  }) {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(releases)
      .where(eq(releases.applicationId, applicationId));

    // By default, exclude drafts and prereleases
    if (!options?.includeDraft) {
      query = query.where(
        and(
          eq(releases.applicationId, applicationId),
          eq(releases.isDraft, false)
        )
      );
    }

    if (!options?.includePrerelease) {
      query = query.where(
        and(
          eq(releases.applicationId, applicationId),
          eq(releases.isPrerelease, false)
        )
      );
    }

    query = query.orderBy(desc(releases.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  /**
   * Get release by tag
   */
  async getReleaseByTag(applicationId: string, tagName: string) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(releases)
      .where(
        and(
          eq(releases.applicationId, applicationId),
          eq(releases.tagName, tagName)
        )
      )
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get latest release
   */
  async getLatestRelease(applicationId: string) {
    const db = await getPostgresDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(releases)
      .where(
        and(
          eq(releases.applicationId, applicationId),
          eq(releases.isDraft, false),
          eq(releases.isPrerelease, false)
        )
      )
      .orderBy(desc(releases.publishedAt))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Create release
   */
  async createRelease(data: {
    applicationId: string;
    tagName: string;
    name: string;
    body?: string;
    commitSha: string;
    isDraft?: boolean;
    isPrerelease?: boolean;
    author: string;
    url?: string;
    publishedAt?: Date;
  }) {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(releases)
      .values({
        applicationId: data.applicationId,
        tagName: data.tagName,
        name: data.name,
        body: data.body,
        commitSha: data.commitSha,
        isDraft: data.isDraft || false,
        isPrerelease: data.isPrerelease || false,
        author: data.author,
        url: data.url,
        publishedAt: data.publishedAt,
      })
      .returning();

    return results[0];
  }

  // ==========================================
  // Activity Log
  // ==========================================

  /**
   * Get activity log for an application
   */
  async getActivityLog(applicationId: string, options?: {
    limit?: number;
    offset?: number;
    type?: string;
  }) {
    const db = await getPostgresDb();
    if (!db) return [];

    let query = db
      .select()
      .from(activityLog)
      .where(eq(activityLog.applicationId, applicationId));

    if (options?.type) {
      query = query.where(
        and(
          eq(activityLog.applicationId, applicationId),
          eq(activityLog.type, options.type)
        )
      );
    }

    query = query.orderBy(desc(activityLog.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  /**
   * Log activity
   */
  async logActivity(data: {
    applicationId?: string;
    type: string;
    action: string;
    message: string;
    actor?: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = await getPostgresDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .insert(activityLog)
      .values(data)
      .returning();

    return results[0];
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get commit count for an application
   */
  async getCommitCount(applicationId: string, days?: number) {
    const db = await getPostgresDb();
    if (!db) return 0;

    let query = db
      .select({ count: sql<number>`count(*)` })
      .from(commits)
      .where(eq(commits.applicationId, applicationId));

    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.where(
        and(
          eq(commits.applicationId, applicationId),
          gte(commits.committedAt, since)
        )
      );
    }

    const results = await query;
    return Number(results[0]?.count || 0);
  }

  /**
   * Get commits by author for an application
   */
  async getCommitsByAuthor(applicationId: string, days: number = 30) {
    const db = await getPostgresDb();
    if (!db) return [];

    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await db
      .select({
        author: commits.authorName,
        count: sql<number>`count(*)`,
      })
      .from(commits)
      .where(
        and(
          eq(commits.applicationId, applicationId),
          gte(commits.committedAt, since)
        )
      )
      .groupBy(commits.authorName)
      .orderBy(sql`count(*) desc`);

    return results.map((r: { author: string; count: number }) => ({
      author: r.author,
      count: Number(r.count),
    }));
  }

  /**
   * Get daily commit count for an application
   */
  async getDailyCommitCount(applicationId: string, days: number = 30) {
    const db = await getPostgresDb();
    if (!db) return [];

    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await db
      .select({
        date: sql<string>`date(${commits.committedAt})`,
        count: sql<number>`count(*)`,
      })
      .from(commits)
      .where(
        and(
          eq(commits.applicationId, applicationId),
          gte(commits.committedAt, since)
        )
      )
      .groupBy(sql`date(${commits.committedAt})`)
      .orderBy(sql`date(${commits.committedAt})`);

    return results.map((r: { date: string; count: number }) => ({
      date: r.date,
      count: Number(r.count),
    }));
  }
}

// Export singleton instance
export const commitsRepo = new CommitsRepository();
