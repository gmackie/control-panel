CREATE TABLE "app_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" text,
	"credentials" text,
	"product_integration_id" uuid,
	"org_integration_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expo_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expo_project_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(255),
	"platform" varchar(50),
	"application_id" uuid,
	"org_integration_id" uuid,
	"last_build_at" timestamp,
	"last_build_status" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expo_projects_expo_project_id_unique" UNIQUE("expo_project_id")
);
--> statement-breakpoint
CREATE TABLE "neon_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"neon_project_id" text NOT NULL,
	"name" text NOT NULL,
	"region_id" varchar(50),
	"application_id" uuid,
	"org_integration_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "neon_projects_neon_project_id_unique" UNIQUE("neon_project_id")
);
--> statement-breakpoint
CREATE TABLE "org_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" text,
	"credentials" text,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" text,
	"credentials" text,
	"org_integration_id" uuid,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(20),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vercel_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vercel_project_id" text NOT NULL,
	"name" text NOT NULL,
	"framework" varchar(50),
	"production_url" text,
	"application_id" uuid,
	"org_integration_id" uuid,
	"last_deployment_at" timestamp,
	"last_deployment_status" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vercel_projects_vercel_project_id_unique" UNIQUE("vercel_project_id")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "repository_path" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "app_type" varchar(50) DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "platform" varchar(50);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "k8s_namespace" varchar(255);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "k8s_deployment_name" varchar(255);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "vercel_project_id" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "expo_project_id" text;--> statement-breakpoint
ALTER TABLE "app_integrations" ADD CONSTRAINT "app_integrations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_integrations" ADD CONSTRAINT "app_integrations_product_integration_id_product_integrations_id_fk" FOREIGN KEY ("product_integration_id") REFERENCES "public"."product_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_integrations" ADD CONSTRAINT "app_integrations_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expo_projects" ADD CONSTRAINT "expo_projects_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expo_projects" ADD CONSTRAINT "expo_projects_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neon_projects" ADD CONSTRAINT "neon_projects_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neon_projects" ADD CONSTRAINT "neon_projects_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_integrations" ADD CONSTRAINT "product_integrations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_integrations" ADD CONSTRAINT "product_integrations_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vercel_projects" ADD CONSTRAINT "vercel_projects_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vercel_projects" ADD CONSTRAINT "vercel_projects_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_integrations_application_id_idx" ON "app_integrations" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "app_integrations_provider_idx" ON "app_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "expo_projects_expo_project_id_idx" ON "expo_projects" USING btree ("expo_project_id");--> statement-breakpoint
CREATE INDEX "expo_projects_application_id_idx" ON "expo_projects" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "neon_projects_neon_project_id_idx" ON "neon_projects" USING btree ("neon_project_id");--> statement-breakpoint
CREATE INDEX "neon_projects_application_id_idx" ON "neon_projects" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "org_integrations_provider_idx" ON "org_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "product_integrations_product_id_idx" ON "product_integrations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_integrations_provider_idx" ON "product_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vercel_projects_vercel_project_id_idx" ON "vercel_projects" USING btree ("vercel_project_id");--> statement-breakpoint
CREATE INDEX "vercel_projects_application_id_idx" ON "vercel_projects" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "applications_product_id_idx" ON "applications" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "applications_app_type_idx" ON "applications" USING btree ("app_type");