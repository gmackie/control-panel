CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`summary` text NOT NULL,
	`description` text,
	`labels` text
);
--> statement-breakpoint
CREATE TABLE `customer_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`current_period_end` text NOT NULL,
	`mrr` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`api_calls` integer DEFAULT 0 NOT NULL,
	`data_processed` integer DEFAULT 0 NOT NULL,
	`active_users` integer DEFAULT 0 NOT NULL,
	`period` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `database_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`database_id` text NOT NULL,
	`reads` integer DEFAULT 0 NOT NULL,
	`writes` integer DEFAULT 0 NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`database_id`) REFERENCES `databases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `databases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`app_id` text NOT NULL,
	`location` text NOT NULL,
	`size` integer NOT NULL,
	`connections` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`namespace` text NOT NULL,
	`repository` text NOT NULL,
	`branch` text NOT NULL,
	`commit` text NOT NULL,
	`commit_message` text NOT NULL,
	`author` text NOT NULL,
	`timestamp` text NOT NULL,
	`status` text NOT NULL,
	`environment` text NOT NULL,
	`url` text
);
--> statement-breakpoint
CREATE TABLE `revenue_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`mrr` real NOT NULL,
	`arr` real NOT NULL,
	`new_customers` integer DEFAULT 0 NOT NULL,
	`churned_customers` integer DEFAULT 0 NOT NULL,
	`revenue` text NOT NULL,
	`top_plans` text NOT NULL,
	`period` text NOT NULL,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_checked` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`cpu` real,
	`memory` real,
	`requests` integer,
	`response_time` real,
	`error_rate` real,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`uptime` text DEFAULT '0%' NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`environment` text DEFAULT 'development' NOT NULL,
	`url` text,
	`last_checked` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage_analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`period` text NOT NULL,
	`requests` integer NOT NULL,
	`unique_users` integer NOT NULL,
	`avg_response_time` real NOT NULL,
	`error_rate` real NOT NULL,
	`p95_response_time` real NOT NULL,
	`p99_response_time` real NOT NULL,
	`top_endpoints` text NOT NULL,
	`timestamp` text NOT NULL
);
