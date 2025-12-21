import { NextResponse } from "next/server";
import { getPostgresDb, isPostgresConfigured } from "@/lib/db/postgres";

/**
 * POST /api/db/migrate
 * 
 * Run database migrations from within the cluster.
 * This is a protected endpoint that should only be called during deployment.
 */
export async function POST(request: Request) {
  // Check for authorization header (simple secret-based auth for internal use)
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET;
  
  if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json({
      success: false,
      error: "PostgreSQL not configured",
    }, { status: 503 });
  }

  try {
    // Get database connection
    const db = await getPostgresDb();
    if (!db) {
      return NextResponse.json({
        success: false,
        error: "Failed to connect to PostgreSQL",
      }, { status: 503 });
    }

    // Import migration utilities
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { sql } = await import("drizzle-orm");
    
    // First, check if we can read the migration files
    // Since we're in a Docker container, migrations folder might not exist
    // Instead, we'll run the SQL directly
    
    // Check if tables already exist
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'applications'
    `);
    
    if (result.rows && result.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Database already migrated - applications table exists",
        tables: result.rows,
      });
    }

    // Run migrations
    // Note: In production, migrations should be bundled with the container
    // For now, we'll create tables manually if they don't exist
    await db.execute(sql`
      -- Create applications table
      CREATE TABLE IF NOT EXISTS "applications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "repository_url" text,
        "repository_full_name" text,
        "default_branch" text DEFAULT 'main',
        "language" text,
        "framework" text,
        "type" text DEFAULT 'web',
        "status" text DEFAULT 'unknown' NOT NULL,
        "settings" jsonb DEFAULT '{"environment":"development","autoDeployEnabled":true}'::jsonb,
        "gitea_repo_id" integer,
        "sentry_project_slug" text,
        "clerk_app_id" text,
        "stripe_account_id" text,
        "posthog_project_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "applications_slug_unique" UNIQUE("slug")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "applications_slug_idx" ON "applications" ("slug");
      CREATE INDEX IF NOT EXISTS "applications_name_idx" ON "applications" ("name");
      CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications" ("status");
    `);

    await db.execute(sql`
      -- Create commits table
      CREATE TABLE IF NOT EXISTS "commits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "sha" text NOT NULL,
        "short_sha" varchar(7) NOT NULL,
        "message" text NOT NULL,
        "author_name" text NOT NULL,
        "author_email" text,
        "author_avatar" text,
        "branch" text NOT NULL,
        "repository" text NOT NULL,
        "url" text,
        "parent_sha" text,
        "additions" integer DEFAULT 0,
        "deletions" integer DEFAULT 0,
        "files_changed" integer DEFAULT 0,
        "committed_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "commits_app_id_idx" ON "commits" ("application_id");
      CREATE UNIQUE INDEX IF NOT EXISTS "commits_sha_idx" ON "commits" ("sha");
      CREATE INDEX IF NOT EXISTS "commits_branch_idx" ON "commits" ("branch");
      CREATE INDEX IF NOT EXISTS "commits_committed_at_idx" ON "commits" ("committed_at");
    `);

    await db.execute(sql`
      -- Create pipeline_runs table
      CREATE TABLE IF NOT EXISTS "pipeline_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "commit_id" uuid REFERENCES "commits"("id"),
        "workflow_name" text NOT NULL,
        "workflow_id" integer,
        "run_number" integer,
        "status" text NOT NULL,
        "conclusion" text,
        "branch" text NOT NULL,
        "event" text NOT NULL,
        "triggered_by" text,
        "started_at" timestamp,
        "finished_at" timestamp,
        "duration" integer,
        "url" text,
        "logs" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "pipeline_runs_app_id_idx" ON "pipeline_runs" ("application_id");
      CREATE INDEX IF NOT EXISTS "pipeline_runs_status_idx" ON "pipeline_runs" ("status");
      CREATE INDEX IF NOT EXISTS "pipeline_runs_created_at_idx" ON "pipeline_runs" ("created_at");
    `);

    await db.execute(sql`
      -- Create pipeline_stages table
      CREATE TABLE IF NOT EXISTS "pipeline_stages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "pipeline_run_id" uuid NOT NULL REFERENCES "pipeline_runs"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "status" text NOT NULL,
        "order" integer NOT NULL,
        "started_at" timestamp,
        "finished_at" timestamp,
        "duration" integer,
        "logs" text,
        "error_message" text
      );
      CREATE INDEX IF NOT EXISTS "pipeline_stages_run_id_idx" ON "pipeline_stages" ("pipeline_run_id");
    `);

    await db.execute(sql`
      -- Create deployments table
      CREATE TABLE IF NOT EXISTS "deployments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "pipeline_run_id" uuid REFERENCES "pipeline_runs"("id"),
        "commit_id" uuid REFERENCES "commits"("id"),
        "environment" text NOT NULL,
        "namespace" text NOT NULL,
        "deployment_name" text NOT NULL,
        "status" text NOT NULL,
        "image_tag" text NOT NULL,
        "image_digest" text,
        "replicas" integer DEFAULT 1,
        "ready_replicas" integer DEFAULT 0,
        "previous_image_tag" text,
        "previous_commit_sha" text,
        "deployed_by" text,
        "deployed_at" timestamp,
        "health_check_status" text,
        "url" text,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "deployments_app_id_idx" ON "deployments" ("application_id");
      CREATE INDEX IF NOT EXISTS "deployments_env_idx" ON "deployments" ("environment");
      CREATE INDEX IF NOT EXISTS "deployments_status_idx" ON "deployments" ("status");
      CREATE INDEX IF NOT EXISTS "deployments_created_at_idx" ON "deployments" ("created_at");
    `);

    await db.execute(sql`
      -- Create environment_status table
      CREATE TABLE IF NOT EXISTS "environment_status" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "environment" text NOT NULL,
        "namespace" text NOT NULL,
        "deployment_name" text NOT NULL,
        "current_commit_sha" text,
        "current_image_tag" text,
        "current_version" text,
        "status" text NOT NULL,
        "replicas" integer,
        "ready_replicas" integer,
        "last_deployed_at" timestamp,
        "last_deployed_by" text,
        "url" text,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "env_status_app_env_idx" ON "environment_status" ("application_id","environment");
    `);

    await db.execute(sql`
      -- Create application_secrets table
      CREATE TABLE IF NOT EXISTS "application_secrets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "encrypted_value" text NOT NULL,
        "iv" text NOT NULL,
        "description" text,
        "environment" text DEFAULT 'all' NOT NULL,
        "is_rotating" boolean DEFAULT false,
        "last_rotated_at" timestamp,
        "expires_at" timestamp,
        "created_by" text,
        "updated_by" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "secrets_app_id_idx" ON "application_secrets" ("application_id");
      CREATE INDEX IF NOT EXISTS "secrets_env_idx" ON "application_secrets" ("environment");
      CREATE UNIQUE INDEX IF NOT EXISTS "secrets_name_env_idx" ON "application_secrets" ("application_id","name","environment");
    `);

    await db.execute(sql`
      -- Create application_integrations table
      CREATE TABLE IF NOT EXISTS "application_integrations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "provider" text NOT NULL,
        "name" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "config" jsonb DEFAULT '{}'::jsonb,
        "last_health_check" timestamp,
        "health_status" text DEFAULT 'unknown',
        "health_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "integrations_app_id_idx" ON "application_integrations" ("application_id");
      CREATE INDEX IF NOT EXISTS "integrations_provider_idx" ON "application_integrations" ("provider");
    `);

    await db.execute(sql`
      -- Create alerts table
      CREATE TABLE IF NOT EXISTS "alerts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid REFERENCES "applications"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "severity" text NOT NULL,
        "status" text NOT NULL,
        "summary" text NOT NULL,
        "description" text,
        "labels" jsonb,
        "annotations" jsonb,
        "starts_at" timestamp NOT NULL,
        "ends_at" timestamp,
        "acknowledged_by" text,
        "acknowledged_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "alerts_app_id_idx" ON "alerts" ("application_id");
      CREATE INDEX IF NOT EXISTS "alerts_status_idx" ON "alerts" ("status");
      CREATE INDEX IF NOT EXISTS "alerts_severity_idx" ON "alerts" ("severity");
    `);

    await db.execute(sql`
      -- Create activity_log table
      CREATE TABLE IF NOT EXISTS "activity_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid REFERENCES "applications"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "action" text NOT NULL,
        "message" text NOT NULL,
        "actor" text,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "activity_log_app_id_idx" ON "activity_log" ("application_id");
      CREATE INDEX IF NOT EXISTS "activity_log_type_idx" ON "activity_log" ("type");
      CREATE INDEX IF NOT EXISTS "activity_log_created_at_idx" ON "activity_log" ("created_at");
    `);

    await db.execute(sql`
      -- Create releases table
      CREATE TABLE IF NOT EXISTS "releases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "tag_name" text NOT NULL,
        "name" text NOT NULL,
        "body" text,
        "commit_sha" text NOT NULL,
        "is_draft" boolean DEFAULT false,
        "is_prerelease" boolean DEFAULT false,
        "author" text NOT NULL,
        "url" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "published_at" timestamp
      );
      CREATE INDEX IF NOT EXISTS "releases_app_id_idx" ON "releases" ("application_id");
      CREATE UNIQUE INDEX IF NOT EXISTS "releases_tag_idx" ON "releases" ("application_id","tag_name");
    `);

    await db.execute(sql`
      -- Create api_keys table
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "key_hash" text NOT NULL,
        "key_prefix" varchar(8) NOT NULL,
        "permissions" jsonb DEFAULT '[]'::jsonb,
        "scopes" jsonb DEFAULT '[]'::jsonb,
        "last_used_at" timestamp,
        "expires_at" timestamp,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "api_keys_app_id_idx" ON "api_keys" ("application_id");
      CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys" ("key_prefix");
    `);

    await db.execute(sql`
      -- Create services table
      CREATE TABLE IF NOT EXISTS "services" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "type" text NOT NULL,
        "status" text DEFAULT 'unknown' NOT NULL,
        "uptime" text DEFAULT '0%' NOT NULL,
        "version" text DEFAULT '1.0.0' NOT NULL,
        "environment" text DEFAULT 'development' NOT NULL,
        "url" text,
        "last_checked" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    await db.execute(sql`
      -- Create service_metrics table
      CREATE TABLE IF NOT EXISTS "service_metrics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "service_id" uuid NOT NULL REFERENCES "services"("id"),
        "cpu" real,
        "memory" real,
        "requests" integer,
        "response_time" real,
        "error_rate" real,
        "timestamp" timestamp NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "service_metrics_service_id_idx" ON "service_metrics" ("service_id");
      CREATE INDEX IF NOT EXISTS "service_metrics_timestamp_idx" ON "service_metrics" ("timestamp");
    `);

    await db.execute(sql`
      -- Create webhook_events table
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "source" text NOT NULL,
        "event_type" text NOT NULL,
        "application_id" uuid REFERENCES "applications"("id"),
        "payload" jsonb NOT NULL,
        "signature" text,
        "processed" boolean DEFAULT false,
        "processed_at" timestamp,
        "error" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "webhook_events_source_idx" ON "webhook_events" ("source");
      CREATE INDEX IF NOT EXISTS "webhook_events_processed_idx" ON "webhook_events" ("processed");
      CREATE INDEX IF NOT EXISTS "webhook_events_created_at_idx" ON "webhook_events" ("created_at");
    `);

    // Verify tables were created
    const verifyResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    return NextResponse.json({
      success: true,
      message: "Database migrations completed successfully",
      tables: verifyResult.rows,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

/**
 * GET /api/db/migrate
 * 
 * Check migration status - list tables in the database.
 */
export async function GET() {
  if (!isPostgresConfigured()) {
    return NextResponse.json({
      configured: false,
      error: "PostgreSQL not configured",
    }, { status: 503 });
  }

  try {
    const db = await getPostgresDb();
    if (!db) {
      return NextResponse.json({
        configured: true,
        connected: false,
        error: "Failed to connect to PostgreSQL",
      }, { status: 503 });
    }

    const { sql } = await import("drizzle-orm");
    
    // List all tables
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    return NextResponse.json({
      configured: true,
      connected: true,
      tables: result.rows,
      tableCount: result.rows.length,
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
