-- Rename linear columns to task columns
ALTER TABLE "tasks" RENAME COLUMN "linear_link" TO "task_link";--> statement-breakpoint
ALTER TABLE "task_comments" RENAME COLUMN "linear_comment_id" TO "task_comment_id";
