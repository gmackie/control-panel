-- Rename linear columns to task columns
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'linear_link') THEN
    ALTER TABLE "tasks" RENAME COLUMN "linear_link" TO "task_link";
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_comments' AND column_name = 'linear_comment_id') THEN
    ALTER TABLE "task_comments" RENAME COLUMN "linear_comment_id" TO "task_comment_id";
  END IF;
END $$;
