import { getDbAsync } from "@/lib/db";
import { applications, eq } from "@repo/db";

export interface AppK8sSelector {
  appLabel: string;
  podPrefix: string;
  namespaces?: string[];
}

/**
 * Resolve an application identifier (uuid/slug/repo) into k8s label selectors.
 *
 * Conventions:
 * - Loki logs are labeled with `app="<appLabel>"`.
 * - Pod names usually start with `podPrefix`.
 */
export async function resolveAppK8sSelector(appIdOrSlugOrRepo: string): Promise<AppK8sSelector> {
  const db = await getDbAsync();
  if (db) {
    const [byId] = await db
      .select({
        slug: applications.slug,
        k8sNamespace: applications.k8sNamespace,
        k8sDeploymentName: applications.k8sDeploymentName,
      })
      .from(applications)
      .where(eq(applications.id, appIdOrSlugOrRepo))
      .limit(1);

    const [bySlug] = byId
      ? [undefined]
      : await db
          .select({
            slug: applications.slug,
            k8sNamespace: applications.k8sNamespace,
            k8sDeploymentName: applications.k8sDeploymentName,
          })
          .from(applications)
          .where(eq(applications.slug, appIdOrSlugOrRepo))
          .limit(1);

    const app = byId ?? bySlug;
    if (app) {
      const podPrefix = app.k8sDeploymentName || app.slug;
      const appLabel = app.k8sDeploymentName || app.slug;
      const namespaces = app.k8sNamespace ? [app.k8sNamespace] : undefined;
      return { appLabel, podPrefix, namespaces };
    }
  }

  // Fallback: treat identifier as repo path or already-a-label string.
  const base = appIdOrSlugOrRepo.includes("/")
    ? (appIdOrSlugOrRepo.split("/")[1] ?? appIdOrSlugOrRepo)
    : appIdOrSlugOrRepo;

  return { appLabel: base, podPrefix: base };
}
