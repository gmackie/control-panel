ALTER TABLE "applications" ADD COLUMN "git_provider" varchar(50) DEFAULT 'github' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "deploy_provider" varchar(50) DEFAULT 'vercel' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "db_provider" varchar(50) DEFAULT 'neon' NOT NULL;--> statement-breakpoint
CREATE INDEX "applications_git_provider_idx" ON "applications" USING btree ("git_provider");--> statement-breakpoint
CREATE INDEX "applications_deploy_provider_idx" ON "applications" USING btree ("deploy_provider");