CREATE TABLE "turso_databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turso_db_id" text NOT NULL,
	"name" text NOT NULL,
	"group" varchar(100),
	"primary_region" varchar(50),
	"hostname" text,
	"application_id" uuid,
	"org_integration_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "turso_databases_turso_db_id_unique" UNIQUE("turso_db_id")
);
--> statement-breakpoint
ALTER TABLE "turso_databases" ADD CONSTRAINT "turso_databases_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turso_databases" ADD CONSTRAINT "turso_databases_org_integration_id_org_integrations_id_fk" FOREIGN KEY ("org_integration_id") REFERENCES "public"."org_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "turso_databases_turso_db_id_idx" ON "turso_databases" USING btree ("turso_db_id");--> statement-breakpoint
CREATE INDEX "turso_databases_application_id_idx" ON "turso_databases" USING btree ("application_id");