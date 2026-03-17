CREATE TABLE "candidate_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"candidate_id" uuid,
	"environment" varchar(32),
	"source" varchar(64) NOT NULL,
	"evidence_type" varchar(64) NOT NULL,
	"freshness_seconds" integer,
	"payload" text NOT NULL,
	"observed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"environment" varchar(32) NOT NULL,
	"cluster_name" varchar(255) NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"workload_name" varchar(255) NOT NULL,
	"argo_app_name" varchar(255) NOT NULL,
	"deployment_repo_path" text NOT NULL,
	"desired_candidate_id" uuid,
	"live_candidate_id" uuid,
	"desired_image" text,
	"live_image" text,
	"drift_status" varchar(64) DEFAULT 'aligned' NOT NULL,
	"last_observed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "known_good_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"environment" varchar(32) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"pinned_by" text,
	"became_known_good_at" timestamp DEFAULT now() NOT NULL,
	"pinned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "override_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"environment" varchar(32) NOT NULL,
	"blocker_reason" varchar(128) NOT NULL,
	"approved_by" text NOT NULL,
	"justification" text NOT NULL,
	"ticket_url" text NOT NULL,
	"snapshot" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_prs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"environment" varchar(32) NOT NULL,
	"repo" text NOT NULL,
	"branch" varchar(255) NOT NULL,
	"pr_number" integer,
	"head_sha" varchar(255),
	"status" varchar(64) DEFAULT 'requested' NOT NULL,
	"merge_policy" varchar(64) DEFAULT 'human_gate' NOT NULL,
	"opened_by" text,
	"merged_by" text,
	"opened_at" timestamp,
	"merged_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"forge_graph_repo_id" varchar(255) NOT NULL,
	"forge_graph_rev_id" varchar(255) NOT NULL,
	"jj_change_id" varchar(255),
	"git_sha" varchar(255),
	"branch" varchar(255),
	"ci_run_id" varchar(255),
	"image_tag" text,
	"image_digest" text,
	"queue_state" varchar(64) DEFAULT 'building' NOT NULL,
	"readiness_status" varchar(64) DEFAULT 'collecting' NOT NULL,
	"supersede_status" varchar(64) DEFAULT 'current' NOT NULL,
	"known_good_status" varchar(64) DEFAULT 'unknown' NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"environment" varchar(32) NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(64) DEFAULT 'release_owner' NOT NULL,
	"can_approve" boolean DEFAULT true NOT NULL,
	"can_override" boolean DEFAULT false NOT NULL,
	"can_merge" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"environment" varchar(32) NOT NULL,
	"required_approver_count" integer DEFAULT 1 NOT NULL,
	"eligible_approver_set" text DEFAULT '[]' NOT NULL,
	"high_risk_requires_second_approver" boolean DEFAULT false NOT NULL,
	"override_allowed" boolean DEFAULT false NOT NULL,
	"override_eligible_set" text DEFAULT '[]' NOT NULL,
	"freshness_thresholds" text DEFAULT '{}' NOT NULL,
	"blocker_policy_definitions" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'healthy' NOT NULL,
	"last_success_at" timestamp,
	"last_observed_at" timestamp,
	"max_freshness_seconds" integer DEFAULT 300 NOT NULL,
	"last_error" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_evidence" ADD CONSTRAINT "candidate_evidence_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_evidence" ADD CONSTRAINT "candidate_evidence_candidate_id_release_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."release_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_states" ADD CONSTRAINT "environment_states_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_states" ADD CONSTRAINT "environment_states_desired_candidate_id_release_candidates_id_fk" FOREIGN KEY ("desired_candidate_id") REFERENCES "public"."release_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_states" ADD CONSTRAINT "environment_states_live_candidate_id_release_candidates_id_fk" FOREIGN KEY ("live_candidate_id") REFERENCES "public"."release_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_good_releases" ADD CONSTRAINT "known_good_releases_candidate_id_release_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."release_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_good_releases" ADD CONSTRAINT "known_good_releases_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "override_records" ADD CONSTRAINT "override_records_candidate_id_release_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."release_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "override_records" ADD CONSTRAINT "override_records_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_prs" ADD CONSTRAINT "promotion_prs_candidate_id_release_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."release_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_prs" ADD CONSTRAINT "promotion_prs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_candidates" ADD CONSTRAINT "release_candidates_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_owners" ADD CONSTRAINT "release_owners_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_policies" ADD CONSTRAINT "release_policies_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_evidence_application_id_idx" ON "candidate_evidence" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "candidate_evidence_candidate_id_idx" ON "candidate_evidence" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_evidence_source_idx" ON "candidate_evidence" USING btree ("source");--> statement-breakpoint
CREATE INDEX "candidate_evidence_observed_at_idx" ON "candidate_evidence" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "environment_states_application_id_idx" ON "environment_states" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "environment_states_environment_idx" ON "environment_states" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "environment_states_drift_status_idx" ON "environment_states" USING btree ("drift_status");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_states_application_environment_idx" ON "environment_states" USING btree ("application_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "known_good_releases_candidate_id_idx" ON "known_good_releases" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "known_good_releases_application_id_idx" ON "known_good_releases" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "known_good_releases_environment_idx" ON "known_good_releases" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "override_records_candidate_id_idx" ON "override_records" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "override_records_application_id_idx" ON "override_records" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "override_records_created_at_idx" ON "override_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "promotion_prs_candidate_id_idx" ON "promotion_prs" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "promotion_prs_application_id_idx" ON "promotion_prs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "promotion_prs_status_idx" ON "promotion_prs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "promotion_prs_pr_number_idx" ON "promotion_prs" USING btree ("pr_number");--> statement-breakpoint
CREATE INDEX "release_candidates_application_id_idx" ON "release_candidates" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "release_candidates_queue_state_idx" ON "release_candidates" USING btree ("queue_state");--> statement-breakpoint
CREATE INDEX "release_candidates_supersede_status_idx" ON "release_candidates" USING btree ("supersede_status");--> statement-breakpoint
CREATE INDEX "release_candidates_known_good_status_idx" ON "release_candidates" USING btree ("known_good_status");--> statement-breakpoint
CREATE UNIQUE INDEX "release_candidates_unique_revision_idx" ON "release_candidates" USING btree ("application_id","forge_graph_repo_id","forge_graph_rev_id");--> statement-breakpoint
CREATE INDEX "release_owners_application_id_idx" ON "release_owners" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "release_owners_user_id_idx" ON "release_owners" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_owners_unique_assignment_idx" ON "release_owners" USING btree ("application_id","environment","user_id");--> statement-breakpoint
CREATE INDEX "release_policies_application_id_idx" ON "release_policies" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_policies_application_environment_idx" ON "release_policies" USING btree ("application_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "source_health_source_idx" ON "source_health" USING btree ("source");--> statement-breakpoint
CREATE INDEX "source_health_status_idx" ON "source_health" USING btree ("status");