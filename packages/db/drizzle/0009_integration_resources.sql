-- Integration Resources table
CREATE TABLE IF NOT EXISTS "integration_resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "integration_id" uuid NOT NULL REFERENCES "org_integrations"("id") ON DELETE CASCADE,
  "resource_type" varchar(100) NOT NULL,
  "resource_id" text NOT NULL,
  "resource_name" text NOT NULL,
  "application_id" uuid REFERENCES "applications"("id") ON DELETE SET NULL,
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "integration_resources_integration_id_idx" ON "integration_resources" ("integration_id");
CREATE INDEX IF NOT EXISTS "integration_resources_application_id_idx" ON "integration_resources" ("application_id");
CREATE INDEX IF NOT EXISTS "integration_resources_resource_type_idx" ON "integration_resources" ("resource_type");
CREATE UNIQUE INDEX IF NOT EXISTS "integration_resources_unique" ON "integration_resources" ("integration_id", "resource_type", "resource_id");

