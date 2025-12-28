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

export const appRouter = router({
  notifications: notificationsRouter,
  activity: activityRouter,
  applications: applicationsRouter,
  clusters: clustersRouter,
  deployments: deploymentsRouter,
  infrastructure: infrastructureRouter,
  monitoring: monitoringRouter,
  resources: resourcesRouter,
});

export type AppRouter = typeof appRouter;
