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
    let page = 1;
    const perPage = 50;

    while (true) {
      const response = await fetch(
        `${giteaUrl}/api/v1/user/repos?page=${page}&limit=${perPage}`,
        {
          headers: {
            'Authorization': `token ${giteaToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: `Gitea API error: ${response.status}` },
          { status: response.status }
        );
      }

      const repos: GiteaRepo[] = await response.json();
      if (repos.length === 0) break;

      allRepos.push(...repos);
      if (repos.length < perPage) break;
      page++;
    }

    return NextResponse.json({ repos: allRepos });
  } catch (error) {
    console.error('Error fetching Gitea repos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
