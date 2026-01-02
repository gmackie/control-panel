CREATE TABLE "notion_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"notion_database_id" text NOT NULL,
	"notion_database_name" text NOT NULL,
	"notion_database_url" text,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_frequency_minutes" integer DEFAULT 15 NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"property_mappings" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notion_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"tasks_created" integer DEFAULT 0 NOT NULL,
	"tasks_updated" integer DEFAULT 0 NOT NULL,
	"tasks_deleted" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_details" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "notion_task_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notion_page_id" text NOT NULL,
	"notion_database_id" text NOT NULL,
	"application_id" uuid,
	"title" text NOT NULL,
	"status" varchar(50) DEFAULT 'not_started' NOT NULL,
	"priority" varchar(50),
	"due_date" timestamp,
	"assignee" text,
	"tags" text,
	"notion_url" text NOT NULL,
	"ai_session_id" uuid,
	"git_branch" varchar(255),
	"pr_number" integer,
	"pr_url" text,
	"pr_status" varchar(50),
	"last_sync_at" timestamp DEFAULT now() NOT NULL,
	"notion_created_at" timestamp,
	"notion_updated_at" timestamp,
	"raw_properties" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notion_configs" ADD CONSTRAINT "notion_configs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_sync_logs" ADD CONSTRAINT "notion_sync_logs_config_id_notion_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."notion_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_task_links" ADD CONSTRAINT "notion_task_links_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_task_links" ADD CONSTRAINT "notion_task_links_ai_session_id_ai_dev_sessions_id_fk" FOREIGN KEY ("ai_session_id") REFERENCES "public"."ai_dev_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notion_configs_application_id_idx" ON "notion_configs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "notion_configs_notion_database_id_idx" ON "notion_configs" USING btree ("notion_database_id");--> statement-breakpoint
CREATE INDEX "notion_sync_logs_config_id_idx" ON "notion_sync_logs" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "notion_sync_logs_started_at_idx" ON "notion_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "notion_task_links_page_id_idx" ON "notion_task_links" USING btree ("notion_page_id");--> statement-breakpoint
CREATE INDEX "notion_task_links_database_id_idx" ON "notion_task_links" USING btree ("notion_database_id");--> statement-breakpoint
CREATE INDEX "notion_task_links_application_id_idx" ON "notion_task_links" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "notion_task_links_ai_session_id_idx" ON "notion_task_links" USING btree ("ai_session_id");--> statement-breakpoint
CREATE INDEX "notion_task_links_status_idx" ON "notion_task_links" USING btree ("status");