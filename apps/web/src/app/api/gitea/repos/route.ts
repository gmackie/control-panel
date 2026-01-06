import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface GiteaRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  created_at: string;
  updated_at: string;
  language: string;
  owner: {
    login: string;
  };
}

interface GiteaOrg {
  id: number;
  username: string;
  full_name: string;
}

async function fetchPaginated<T>(
  baseUrl: string,
  endpoint: string,
  token: string,
  perPage: number = 50
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=${perPage}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Gitea API error: ${response.status}`);
    }

    const items: T[] = await response.json();
    if (items.length === 0) break;

    allItems.push(...items);
    if (items.length < perPage) break;
    page++;
  }

  return allItems;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const giteaUrl = process.env.GITEA_URL || 'https://git.gmac.io';
    const giteaToken = process.env.GITEA_TOKEN;

    if (!giteaToken) {
      return NextResponse.json({ error: 'GITEA_TOKEN not configured' }, { status: 500 });
    }

    const allRepos: GiteaRepo[] = [];
    const seenIds = new Set<number>();

    const userRepos = await fetchPaginated<GiteaRepo>(
      giteaUrl,
      '/api/v1/user/repos',
      giteaToken
    );
    
    for (const repo of userRepos) {
      if (!seenIds.has(repo.id)) {
        seenIds.add(repo.id);
        allRepos.push(repo);
      }
    }

    try {
      const orgs = await fetchPaginated<GiteaOrg>(
        giteaUrl,
        '/api/v1/user/orgs',
        giteaToken
      );

      for (const org of orgs) {
        try {
          const orgRepos = await fetchPaginated<GiteaRepo>(
            giteaUrl,
            `/api/v1/orgs/${org.username}/repos`,
            giteaToken
          );
          
          for (const repo of orgRepos) {
            if (!seenIds.has(repo.id)) {
              seenIds.add(repo.id);
              allRepos.push(repo);
            }
          }
        } catch (orgErr) {
          console.warn(`Failed to fetch repos for org ${org.username}:`, orgErr);
        }
      }
    } catch (orgsErr) {
      console.warn('Failed to fetch user organizations:', orgsErr);
    }

    allRepos.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json({ repos: allRepos, count: allRepos.length });
  } catch (error) {
    console.error('Error fetching Gitea repos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
