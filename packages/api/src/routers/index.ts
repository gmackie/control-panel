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
import { pipelinesRouter } from "./pipelines";
import { resourcesRouter } from "./resources";
import { aiDevRouter } from "./ai-dev";
import { notionRouter } from "./notion";
import { tasksRouter } from "./tasks";
import { releasesRouter } from "./releases";
import { syncRouter } from "./sync";
import { webhooksRouter } from "./webhooks";
import { apiKeysRouter } from "./api-keys";
import { integrationsRouter } from "./integrations";
import { templatesRouter } from "./templates";
import { ciPipelinesRouter } from "./ci-pipelines";
import { argoAppsRouter } from "./argo-apps";
import { appOverviewRouter } from "./app-overview";
import { releaseQueueRouter } from "./release-queue";
import { releaseCandidatesRouter } from "./release-candidates";
import { releasePoliciesRouter } from "./release-policies";
import { promotionPrsRouter } from "./promotion-prs";
import { releaseAuditRouter } from "./release-audit";
import { sourceTrustRouter } from "./source-trust";

export const appRouter = router({
  notifications: notificationsRouter,
  activity: activityRouter,
  applications: applicationsRouter,
  clusters: clustersRouter,
  deployments: deploymentsRouter,
  infrastructure: infrastructureRouter,
  monitoring: monitoringRouter,
  pipelines: pipelinesRouter,
  resources: resourcesRouter,
  aiDev: aiDevRouter,
  notion: notionRouter,
  tasks: tasksRouter,
  releases: releasesRouter,
  sync: syncRouter,
  webhooks: webhooksRouter,
  apiKeys: apiKeysRouter,
  integrations: integrationsRouter,
  templates: templatesRouter,
  ciPipelines: ciPipelinesRouter,
  argoApps: argoAppsRouter,
  appOverview: appOverviewRouter,
  releaseQueue: releaseQueueRouter,
  releaseCandidates: releaseCandidatesRouter,
  releasePolicies: releasePoliciesRouter,
  promotionPrs: promotionPrsRouter,
  releaseAudit: releaseAuditRouter,
  sourceTrust: sourceTrustRouter,
});

export type AppRouter = typeof appRouter;
