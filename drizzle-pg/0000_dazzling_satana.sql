CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"type" text NOT NULL,
	"action" text NOT NULL,
	"message" text NOT NULL,
	"actor" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"pipeline_run_id" uuid,
	"commit_id" uuid,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environment_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"commit_id" uuid,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_run_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"order" integer NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"duration" integer,
	"logs" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"cpu" real,
	"memory" real,
	"requests" integer,
	"response_time" real,
	"error_rate" real,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"application_id" uuid,
	"payload" jsonb NOT NULL,
	"signature" text,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_app_id_idx" ON "activity_log" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_type_idx" ON "activity_log" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_created_at_idx" ON "activity_log" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_app_id_idx" ON "alerts" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_status_idx" ON "alerts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_severity_idx" ON "alerts" ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_app_id_idx" ON "api_keys" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys" ("key_prefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_app_id_idx" ON "application_integrations" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_provider_idx" ON "application_integrations" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "secrets_app_id_idx" ON "application_secrets" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "secrets_env_idx" ON "application_secrets" ("environment");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "secrets_name_env_idx" ON "application_secrets" ("application_id","name","environment");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "applications_slug_idx" ON "applications" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_name_idx" ON "applications" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commits_app_id_idx" ON "commits" ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commits_sha_idx" ON "commits" ("sha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commits_branch_idx" ON "commits" ("branch");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commits_committed_at_idx" ON "commits" ("committed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_app_id_idx" ON "deployments" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_env_idx" ON "deployments" ("environment");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_status_idx" ON "deployments" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_created_at_idx" ON "deployments" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "env_status_app_env_idx" ON "environment_status" ("application_id","environment");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_runs_app_id_idx" ON "pipeline_runs" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_runs_status_idx" ON "pipeline_runs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_runs_created_at_idx" ON "pipeline_runs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_stages_run_id_idx" ON "pipeline_stages" ("pipeline_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "releases_app_id_idx" ON "releases" ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "releases_tag_idx" ON "releases" ("application_id","tag_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_metrics_service_id_idx" ON "service_metrics" ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_metrics_timestamp_idx" ON "service_metrics" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_source_idx" ON "webhook_events" ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_processed_idx" ON "webhook_events" ("processed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_created_at_idx" ON "webhook_events" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alerts" ADD CONSTRAINT "alerts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_integrations" ADD CONSTRAINT "application_integrations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_secrets" ADD CONSTRAINT "application_secrets_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commits" ADD CONSTRAINT "commits_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_pipeline_run_id_pipeline_runs_id_fk" FOREIGN KEY ("pipeline_run_id") REFERENCES "pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_commit_id_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "commits"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environment_status" ADD CONSTRAINT "environment_status_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_commit_id_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "commits"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_run_id_pipeline_runs_id_fk" FOREIGN KEY ("pipeline_run_id") REFERENCES "pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "releases" ADD CONSTRAINT "releases_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_metrics" ADD CONSTRAINT "service_metrics_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
