export interface DevFixtureProduct {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DevFixtureApplication {
  id: string;
  name: string;
  description: string;
  slug: string;
  productId?: string | null;
  repositoryUrl?: string | null;
  status?: string;
  gitProvider?: string | null;
  deployProvider?: string | null;
  dbProvider?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const nowIso = () => new Date().toISOString();

export const devFixtureProducts: DevFixtureProduct[] = [
  {
    id: 'prod-gmac',
    name: 'GMAC Core',
    slug: 'gmac-core',
    description: 'Local dev fixtures',
    icon: null,
    color: '#1f2937',
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'prod-labs',
    name: 'Labs',
    slug: 'labs',
    description: 'Experimental apps (fixtures)',
    icon: null,
    color: '#0f766e',
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const devFixtureApplications: DevFixtureApplication[] = [
  {
    id: 'app-control-panel',
    name: 'Control Panel',
    slug: 'control-panel',
    description: 'GMAC.IO infrastructure control panel (fixture)',
    productId: 'prod-gmac',
    repositoryUrl: 'https://git.gmac.io/gmac/control-panel',
    status: 'active',
    gitProvider: 'gitea',
    deployProvider: 'kubernetes',
    dbProvider: 'neon',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'app-starter',
    name: 'Starter App',
    slug: 'starter-app',
    description: 'A sample application used for UI QA (fixture)',
    productId: 'prod-labs',
    repositoryUrl: 'https://github.com/gmackie/starter-app',
    status: 'active',
    gitProvider: 'github',
    deployProvider: 'vercel',
    dbProvider: 'turso',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'app-unassigned',
    name: 'Unassigned Demo',
    slug: 'unassigned-demo',
    description: 'No product assigned (fixture)',
    productId: null,
    repositoryUrl: null,
    status: 'active',
    gitProvider: null,
    deployProvider: null,
    dbProvider: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export function findDevFixtureApplication(idOrSlug: string): DevFixtureApplication | null {
  const decoded = decodeURIComponent(idOrSlug);
  return (
    devFixtureApplications.find((a) => a.id === decoded) ||
    devFixtureApplications.find((a) => a.slug === decoded) ||
    null
  );
}
