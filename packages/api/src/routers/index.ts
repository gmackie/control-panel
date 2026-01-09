/**
 * Main App Router
 * 
 * Combines all sub-routers into the main app router
 */

import { router } from "../trpc";
import { notificationsRouter } from "./notifications";
import { activityRouter } from "./activity";
import { applicationsRouter } from "./applications";
import { clustersRouter } from "./clusters";
import { deploymentsRouter } from "./deployments";
import { infrastructureRouter } from "./infrastructure";
import { monitoringRouter } from "./monitoring";
import { resourcesRouter } from "./resources";
import { aiDevRouter } from "./ai-dev";
import { notionRouter } from "./notion";
import { tasksRouter } from "./tasks";
import { releasesRouter } from "./releases";
import { syncRouter } from "./sync";
import { webhooksRouter } from "./webhooks";
import { apiKeysRouter } from "./api-keys";
import { integrationsRouter } from "./integrations";

export const appRouter = router({
  notifications: notificationsRouter,
  activity: activityRouter,
  applications: applicationsRouter,
  clusters: clustersRouter,
  deployments: deploymentsRouter,
  infrastructure: infrastructureRouter,
  monitoring: monitoringRouter,
  resources: resourcesRouter,
  aiDev: aiDevRouter,
  notion: notionRouter,
  tasks: tasksRouter,
  releases: releasesRouter,
  sync: syncRouter,
  webhooks: webhooksRouter,
  apiKeys: apiKeysRouter,
  integrations: integrationsRouter,
});

export type AppRouter = typeof appRouter;
