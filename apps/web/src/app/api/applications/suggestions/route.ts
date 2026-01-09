import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { K3sService } from '@/lib/k3s/k3s-service';
import { getDbAsync } from '@/lib/db';
import { applications, eq } from '@repo/db';

interface IntegrationResource {
  id: string;
  name: string;
  type: string;
  provider: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

interface ApplicationSuggestion {
  suggestedName: string;
  suggestedSlug: string;
  confidence: number;
  matchedResources: {
    provider: string;
    type: string;
    name: string;
    id: string;
    url?: string;
  }[];
  existingAppId?: string;
}

function normalizeAppName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]+/g, '-')
    .replace(/-+(staging|prod|production|dev|development|api|web|app|service|svc|backend|frontend)$/g, '')
    .replace(/^(staging|prod|production|dev|development)-+/g, '')
    .replace(/[-_]+db$/g, '')
    .replace(/[-_]+database$/g, '')
    .replace(/^[-_]+|[-_]+$/g, '');
}

function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeAppName(a);
  const normB = normalizeAppName(b);
  
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;
  
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 0;
  
  let matches = 0;
  const shorter = normA.length < normB.length ? normA : normB;
  const longer = normA.length < normB.length ? normB : normA;
  
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return matches / maxLen;
}

async function fetchGitHubRepos(): Promise<IntegrationResource[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) return [];
    const repos = await response.json();

    return repos.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      type: 'repository',
      provider: 'github',
      url: repo.html_url,
      metadata: {
        fullName: repo.full_name,
        language: repo.language,
        private: repo.private,
        defaultBranch: repo.default_branch,
      },
    }));
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    return [];
  }
}

async function fetchGiteaRepos(): Promise<IntegrationResource[]> {
  const token = process.env.GITEA_TOKEN;
  const url = process.env.GITEA_URL || 'https://git.gmac.io';
  if (!token) return [];

  try {
    const response = await fetch(`${url}/api/v1/user/repos?limit=100`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return [];
    const repos = await response.json();

    return repos.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      type: 'repository',
      provider: 'gitea',
      url: repo.html_url,
      metadata: {
        fullName: repo.full_name,
        language: repo.language,
        private: repo.private,
        defaultBranch: repo.default_branch,
      },
    }));
  } catch (error) {
    console.error('Error fetching Gitea repos:', error);
    return [];
  }
}

async function fetchVercelProjects(): Promise<IntegrationResource[]> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return [];

  try {
    const response = await fetch('https://api.vercel.com/v9/projects?limit=100', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return [];
    const data = await response.json();

    return (data.projects || []).map((project: any) => ({
      id: project.id,
      name: project.name,
      type: 'project',
      provider: 'vercel',
      url: `https://vercel.com/${project.accountId}/${project.name}`,
      metadata: {
        framework: project.framework,
        nodeVersion: project.nodeVersion,
      },
    }));
  } catch (error) {
    console.error('Error fetching Vercel projects:', error);
    return [];
  }
}

async function fetchNeonProjects(): Promise<IntegrationResource[]> {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://console.neon.tech/api/v2/projects', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return [];
    const data = await response.json();

    return (data.projects || []).map((project: any) => ({
      id: project.id,
      name: project.name,
      type: 'database',
      provider: 'neon',
      url: `https://console.neon.tech/app/projects/${project.id}`,
      metadata: {
        regionId: project.region_id,
        pgVersion: project.pg_version,
      },
    }));
  } catch (error) {
    console.error('Error fetching Neon projects:', error);
    return [];
  }
}

async function fetchK8sResources(): Promise<IntegrationResource[]> {
  const k3sService = new K3sService();
  const resources: IntegrationResource[] = [];

  try {
    const namespaces = await k3sService.getNamespaces();
    const systemNs = ['kube-system', 'kube-public', 'kube-node-lease', 'default'];
    const userNamespaces = namespaces.filter(ns => !systemNs.includes(ns));

    for (const ns of userNamespaces) {
      resources.push({
        id: `ns-${ns}`,
        name: ns,
        type: 'namespace',
        provider: 'k8s',
        metadata: {},
      });
    }

    const deployments = await k3sService.getDeployments();
    for (const dep of deployments) {
      if (systemNs.includes(dep.namespace)) continue;
      resources.push({
        id: `dep-${dep.namespace}-${dep.name}`,
        name: dep.name,
        type: 'deployment',
        provider: 'k8s',
        metadata: {
          namespace: dep.namespace,
          replicas: dep.replicas,
          readyReplicas: dep.readyReplicas,
          image: dep.image,
        },
      });
    }

    const services = await k3sService.getServices();
    for (const svc of services) {
      if (systemNs.includes(svc.namespace)) continue;
      if (svc.name === 'kubernetes') continue;
      resources.push({
        id: `svc-${svc.namespace}-${svc.name}`,
        name: svc.name,
        type: 'service',
        provider: 'k8s',
        metadata: {
          namespace: svc.namespace,
          clusterIP: svc.clusterIP,
          ports: svc.ports,
        },
      });
    }

    const ingresses = await k3sService.getIngresses();
    for (const ing of ingresses) {
      if (systemNs.includes(ing.namespace)) continue;
      resources.push({
        id: `ing-${ing.namespace}-${ing.name}`,
        name: ing.name,
        type: 'ingress',
        provider: 'k8s',
        url: ing.hosts[0] ? `https://${ing.hosts[0]}` : undefined,
        metadata: {
          namespace: ing.namespace,
          hosts: ing.hosts,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching K8s resources:', error);
  }

  return resources;
}

async function fetchExpoProjects(): Promise<IntegrationResource[]> {
  const token = process.env.EXPO_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const accountsResponse = await fetch('https://api.expo.dev/v2/accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!accountsResponse.ok) return [];
    const accountsData = await accountsResponse.json();
    const accounts = Array.isArray(accountsData) ? accountsData : accountsData.data || [];

    const resources: IntegrationResource[] = [];

    for (const account of accounts) {
      const projectsResponse = await fetch(
        `https://api.expo.dev/v2/accounts/${account.name}/projects`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!projectsResponse.ok) continue;
      const projectsData = await projectsResponse.json();
      const projects = Array.isArray(projectsData) ? projectsData : projectsData.data || projectsData.projects || [];

      for (const project of projects) {
        resources.push({
          id: project.id,
          name: project.name || project.slug,
          type: 'mobile-app',
          provider: 'expo',
          url: `https://expo.dev/accounts/${account.name}/projects/${project.slug}`,
          metadata: {
            slug: project.slug,
            fullName: project.fullName,
            platforms: project.platforms,
          },
        });
      }
    }

    return resources;
  } catch (error) {
    console.error('Error fetching Expo projects:', error);
    return [];
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [githubRepos, giteaRepos, vercelProjects, neonDatabases, k8sResources, expoProjects] =
      await Promise.all([
        fetchGitHubRepos(),
        fetchGiteaRepos(),
        fetchVercelProjects(),
        fetchNeonProjects(),
        fetchK8sResources(),
        fetchExpoProjects(),
      ]);

    const allResources = [
      ...githubRepos,
      ...giteaRepos,
      ...vercelProjects,
      ...neonDatabases,
      ...k8sResources,
      ...expoProjects,
    ];

    const db = await getDbAsync();
    const existingApps = db ? await db.select().from(applications) : [];

    const groups: Map<string, IntegrationResource[]> = new Map();

    for (const resource of allResources) {
      const normalized = normalizeAppName(resource.name);
      if (!normalized || normalized.length < 2) continue;

      let matchedGroup: string | null = null;
      let bestScore = 0;

      for (const [groupName] of groups) {
        const score = calculateSimilarity(normalized, groupName);
        if (score > 0.8 && score > bestScore) {
          matchedGroup = groupName;
          bestScore = score;
        }
      }

      if (matchedGroup) {
        groups.get(matchedGroup)!.push(resource);
      } else {
        groups.set(normalized, [resource]);
      }
    }

    const suggestions: ApplicationSuggestion[] = [];

    for (const [groupName, resources] of groups) {
      if (resources.length < 2) continue;

      const providers = new Set(resources.map(r => r.provider));
      if (providers.size < 2) continue;

      const existingApp = existingApps.find(app => {
        const appNormalized = normalizeAppName(app.name);
        return calculateSimilarity(appNormalized, groupName) > 0.8;
      });

      const providerCoverage = providers.size / 6;
      const resourceCount = Math.min(resources.length / 10, 1);
      const confidence = Math.round((0.5 + providerCoverage * 0.3 + resourceCount * 0.2) * 100) / 100;

      suggestions.push({
        suggestedName: resources[0].name,
        suggestedSlug: groupName,
        confidence,
        matchedResources: resources.map(r => ({
          provider: r.provider,
          type: r.type,
          name: r.name,
          id: r.id,
          url: r.url,
        })),
        existingAppId: existingApp?.id,
      });
    }

    suggestions.sort((a, b) => {
      if (a.existingAppId && !b.existingAppId) return -1;
      if (!a.existingAppId && b.existingAppId) return 1;
      return b.confidence - a.confidence;
    });

    return NextResponse.json({
      suggestions: suggestions.slice(0, 50),
      totalResources: allResources.length,
      resourcesByProvider: {
        github: githubRepos.length,
        gitea: giteaRepos.length,
        vercel: vercelProjects.length,
        neon: neonDatabases.length,
        k8s: k8sResources.length,
        expo: expoProjects.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating application suggestions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
