CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"source" varchar(100) NOT NULL,
	"category" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"severity" varchar(50) NOT NULL,
	"app_id" uuid,
	"app_name" text,
	"environment" varchar(50),
	"title" text NOT NULL,
	"description" text,
	"actor_type" varchar(50),
	"actor_id" text,
	"actor_name" text,
	"actor_email" text,
	"actor_avatar" text,
	"links" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"severity" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"summary" text NOT NULL,
	"description" text,
	"labels" text
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"repository_url" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "applications_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"application_id" uuid,
	"environment" varchar(50),
	"provider" varchar(100),
	"category" varchar(100),
	"amount" real NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"period" varchar(50) NOT NULL,
	"current_spend" real DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp,
	"alert_thresholds" text,
	"alert_channels" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_aggregations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregation_type" varchar(50) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"provider" varchar(100),
	"application_id" uuid,
	"application_name" text,
	"environment" varchar(50),
	"category" varchar(100),
	"total_amount" real NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"entry_count" integer NOT NULL,
	"by_resource_type" text,
	"by_service" text,
	"previous_period_amount" real,
	"change_percent" real,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"severity" varchar(50) NOT NULL,
	"budget_id" uuid,
	"application_id" uuid,
	"provider" varchar(100),
	"title" text NOT NULL,
	"message" text NOT NULL,
	"threshold_percent" real,
	"current_amount" real,
	"budget_amount" real,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"notified_via" text,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"service" varchar(100) NOT NULL,
	"resource_id" text NOT NULL,
	"resource_name" text NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"application_id" uuid,
	"application_name" text,
	"environment" varchar(50),
	"namespace" varchar(255),
	"amount" real NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"period" varchar(50) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"usage_quantity" real,
	"usage_unit" varchar(50),
	"category" varchar(100) NOT NULL,
	"tags" text,
	"metadata" text,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"mrr" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"api_calls" integer DEFAULT 0 NOT NULL,
	"data_processed" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"period" varchar(50) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL,
	"reads" integer DEFAULT 0 NOT NULL,
	"writes" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"app_id" uuid NOT NULL,
	"location" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"connections" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"repository" text NOT NULL,
	"branch" varchar(255) NOT NULL,
	"commit" varchar(255) NOT NULL,
	"commit_message" text NOT NULL,
	"author" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) NOT NULL,
	"environment" varchar(50) NOT NULL,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "integration_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" text NOT NULL,
	"integration_type" varchar(100) NOT NULL,
	"application_id" uuid,
	"application_name" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"usage_type" varchar(100) NOT NULL,
	"usage_quantity" real NOT NULL,
	"usage_unit" varchar(50) NOT NULL,
	"amount" real NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"breakdown" text,
	"metadata" text,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"success" boolean NOT NULL,
	"error" text,
	"message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"slack_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"category_preferences" text,
	"quiet_hours" text,
	"email_digest" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" text NOT NULL,
	"channels" text NOT NULL,
	"dedupe" text,
	"schedule" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"source" varchar(100) NOT NULL,
	"source_event_id" text,
	"activity_event_id" uuid,
	"category" varchar(100) NOT NULL,
	"severity" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"app_id" uuid,
	"app_name" text,
	"environment" varchar(50),
	"actions" text,
	"links" text,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp,
	"resolved_by" text,
	"resolved_at" timestamp,
	"snoozed_until" timestamp,
	"group_key" text,
	"group_count" integer DEFAULT 1,
	"delivered_via" text,
	"user_id" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text,
	"platform" varchar(50) NOT NULL,
	"push_token" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mrr" real NOT NULL,
	"arr" real NOT NULL,
	"new_customers" integer DEFAULT 0 NOT NULL,
	"churned_customers" integer DEFAULT 0 NOT NULL,
	"revenue" text NOT NULL,
	"top_plans" text NOT NULL,
	"period" varchar(50) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"config" text NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_checked" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"cpu" real,
	"memory" real,
	"requests" integer,
	"response_time" real,
	"error_rate" real,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'unknown' NOT NULL,
	"uptime" varchar(20) DEFAULT '0%',
	"version" varchar(50) DEFAULT '1.0.0',
	"environment" varchar(50) DEFAULT 'development',
	"url" text,
	"last_checked" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"period" varchar(50) NOT NULL,
	"requests" integer NOT NULL,
	"unique_users" integer NOT NULL,
	"avg_response_time" real NOT NULL,
	"error_rate" real NOT NULL,
	"p95_response_time" real NOT NULL,
	"p99_response_time" real NOT NULL,
	"top_endpoints" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar" text,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_usage" ADD CONSTRAINT "customer_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_operations" ADD CONSTRAINT "database_operations_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_integrations" ADD CONSTRAINT "service_integrations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_metrics" ADD CONSTRAINT "service_metrics_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_agg_type_idx" ON "cost_aggregations" USING btree ("aggregation_type");--> statement-breakpoint
CREATE INDEX "cost_agg_period_idx" ON "cost_aggregations" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "cost_agg_app_idx" ON "cost_aggregations" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "cost_entries_provider_idx" ON "cost_entries" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "cost_entries_application_idx" ON "cost_entries" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "cost_entries_period_start_idx" ON "cost_entries" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "cost_entries_category_idx" ON "cost_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "int_costs_integration_idx" ON "integration_costs" USING btree ("integration_type");--> statement-breakpoint
CREATE INDEX "int_costs_app_idx" ON "integration_costs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "int_costs_period_idx" ON "integration_costs" USING btree ("period_start");