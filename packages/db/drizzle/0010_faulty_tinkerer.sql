ALTER TABLE "app_integrations" ADD COLUMN "environment" varchar(50);--> statement-breakpoint
ALTER TABLE "app_integrations" ADD COLUMN "k8s_deployment_id" uuid;--> statement-breakpoint
ALTER TABLE "app_integrations" ADD COLUMN "k8s_namespace" varchar(255);--> statement-breakpoint
ALTER TABLE "app_integrations" ADD COLUMN "detected_from_k8s" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_integrations" ADD CONSTRAINT "app_integrations_k8s_deployment_id_k3s_deployments_id_fk" FOREIGN KEY ("k8s_deployment_id") REFERENCES "public"."k3s_deployments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_integrations_environment_idx" ON "app_integrations" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "app_integrations_k8s_deployment_idx" ON "app_integrations" USING btree ("k8s_deployment_id");--> statement-breakpoint
CREATE INDEX "app_integrations_unique_app_provider_env" ON "app_integrations" USING btree ("application_id","provider","environment");