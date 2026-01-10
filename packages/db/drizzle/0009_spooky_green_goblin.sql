CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"permissions" text DEFAULT '[]' NOT NULL,
	"last_used_at" timestamp,
	"last_used_ip" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gitea_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gitea_repo_id" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text,
	"html_url" text,
	"clone_url" text,
	"ssh_url" text,
	"default_branch" varchar(100),
	"owner" varchar(255),
	"private" boolean DEFAULT false,
	"fork" boolean DEFAULT false,
	"archived" boolean DEFAULT false,
	"stars" integer DEFAULT 0,
	"forks" integer DEFAULT 0,
	"open_issues" integer DEFAULT 0,
	"application_id" uuid,
	"org_integration_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gitea_repositories_gitea_repo_id_unique" UNIQUE("gitea_repo_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_repo_id" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text,
	"html_url" text,
	"clone_url" text,
	"ssh_url" text,
	"default_branch" varchar(100),
	"owner" varchar(255),
	"private" boolean DEFAULT false,
	"fork" boolean DEFAULT false,
	"archived" boolean DEFAULT false,
	"stars" integer DEFAULT 0,
	"forks" integer DEFAULT 0,
	"open_issues" integer DEFAULT 0,
	"topics" text,
	"language" varchar(100),
	"application_id" uuid,
	"org_integration_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_repositories_github_repo_id_unique" UNIQUE("github_repo_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" text NOT NULL,
	"resource_name" text NOT NULL,
	"application_id" uuid,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "k3s_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"k3s_deployment_id" text NOT NULL,
	"name" text NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"cluster_name" varchar(255),
	"kind" varchar(50) DEFAULT 'Deployment' NOT NULL,
	"replicas" integer DEFAULT 1,
	"ready_replicas" integer DEFAULT 0,
	"image" text,
	"container_port" integer,
	"service_type" varchar(50),
	"ingress_host" text,
	"status" varchar(50) DEFAULT 'unknown',
	"application_id" uuid,
	"org_integration_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "k3s_deployments_k3s_deployment_id_unique" UNIQUE("k3s_deployment_id")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "local_repo_path" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitea_repositories" ADD CONSTRAINT "gitea_repositories_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gitea_repositories" ADD CONSTRAINT "gitea_repositories_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_resources" ADD CONSTRAINT "integration_resources_integration_id_org_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_resources" ADD CONSTRAINT "integration_resources_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "k3s_deployments" ADD CONSTRAINT "k3s_deployments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "k3s_deployments" ADD CONSTRAINT "k3s_deployments_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gitea_repositories_gitea_repo_id_idx" ON "gitea_repositories" USING btree ("gitea_repo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gitea_repositories_application_id_idx" ON "gitea_repositories" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gitea_repositories_full_name_idx" ON "gitea_repositories" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repositories_github_repo_id_idx" ON "github_repositories" USING btree ("github_repo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repositories_application_id_idx" ON "github_repositories" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repositories_full_name_idx" ON "github_repositories" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_resources_integration_id_idx" ON "integration_resources" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_resources_application_id_idx" ON "integration_resources" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_resources_resource_type_idx" ON "integration_resources" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_resources_unique" ON "integration_resources" USING btree ("integration_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "k3s_deployments_k3s_deployment_id_idx" ON "k3s_deployments" USING btree ("k3s_deployment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "k3s_deployments_application_id_idx" ON "k3s_deployments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "k3s_deployments_namespace_idx" ON "k3s_deployments" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "k3s_deployments_cluster_name_idx" ON "k3s_deployments" USING btree ("cluster_name");