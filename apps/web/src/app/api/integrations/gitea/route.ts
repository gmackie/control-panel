import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GiteaService } from '@/lib/gitea/gitea-service';
import { GiteaClient } from '@/lib/gitea/client';

// Initialize the real Gitea service
const giteaService = new GiteaService();

// Initialize the Gitea client for direct API calls
const giteaClient = new GiteaClient({
  baseUrl: process.env.GITEA_URL || 'https://git.gmac.io',
  token: process.env.GITEA_TOKEN || '',
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'overview';

    switch (endpoint) {
      case 'overview': {
        // Fetch real data from Gitea
        const [repositories, currentUser, organizations, health] = await Promise.all([
          giteaService.getRepositories(),
          giteaService.getCurrentUser(),
          giteaService.getOrganizations(),
          giteaService.healthCheck(),
        ]);

        // Get recent commits from first few repos
        const recentCommits: any[] = [];
        for (const repo of repositories.slice(0, 5)) {
          try {
            const [owner, repoName] = repo.full_name.split('/');
            const commits = await giteaService.getCommits(owner, repoName, { limit: 3 });
            recentCommits.push(...commits.map(c => ({
              ...c,
              repository: {
                name: repo.name,
                full_name: repo.full_name,
                html_url: repo.html_url,
              }
            })));
          } catch (e) {
            // Skip repos with errors
          }
        }

        // Sort commits by date
        recentCommits.sort((a, b) => 
          new Date(b.commit?.author?.date || b.created).getTime() - 
          new Date(a.commit?.author?.date || a.created).getTime()
        );

        return NextResponse.json({
          repositories: repositories.map(repo => ({
            ...repo,
            visibility: repo.private ? 'private' : 'public',
            pushed_at: repo.updated_at,
            created_at: repo.updated_at, // Gitea API returns updated_at
            owner: {
              id: 1,
              login: repo.full_name.split('/')[0],
              full_name: repo.full_name.split('/')[0],
              email: '',
              avatar_url: `${process.env.GITEA_URL}/avatars/1`,
              html_url: `${process.env.GITEA_URL}/${repo.full_name.split('/')[0]}`,
            },
            permissions: {
              admin: true,
              push: true,
              pull: true,
            },
          })),
          users: currentUser ? [currentUser] : [],
          organizations,
          recentCommits: recentCommits.slice(0, 10),
          stats: {
            counters: {
              repo: repositories.length,
              org: organizations.length,
              user: currentUser ? 1 : 0,
            }
          },
          health: {
            status: health ? 'healthy' : 'unhealthy',
            responseTime: 0,
            version: 'unknown',
          },
          summary: {
            totalRepositories: repositories.length,
            privateRepositories: repositories.filter(r => r.private).length,
            totalUsers: currentUser ? 1 : 0,
            totalOrganizations: organizations.length,
            totalCommits: recentCommits.length,
            lastActivity: recentCommits[0]?.commit?.author?.date || new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      case 'repositories': {
        const repos = await giteaService.getRepositories();
        const repoFilter = searchParams.get('filter'); // public, private, all
        const filteredRepos = repoFilter === 'public' ? repos.filter(r => !r.private) :
                             repoFilter === 'private' ? repos.filter(r => r.private) : repos;
        
        return NextResponse.json({
          repositories: filteredRepos.map(repo => ({
            ...repo,
            visibility: repo.private ? 'private' : 'public',
            pushed_at: repo.updated_at,
            created_at: repo.updated_at,
            owner: {
              id: 1,
              login: repo.full_name.split('/')[0],
              full_name: repo.full_name.split('/')[0],
              email: '',
              avatar_url: `${process.env.GITEA_URL}/avatars/1`,
              html_url: `${process.env.GITEA_URL}/${repo.full_name.split('/')[0]}`,
            },
            permissions: {
              admin: true,
              push: true,
              pull: true,
            },
          })),
          pagination: {
            total: filteredRepos.length,
            page: 1,
            per_page: 50,
          },
        });
      }

      case 'users': {
        const currentUser = await giteaService.getCurrentUser();
        return NextResponse.json({
          users: currentUser ? [currentUser] : [],
          pagination: {
            total: currentUser ? 1 : 0,
            page: 1,
            per_page: 50,
          },
        });
      }

      case 'organizations': {
        const orgs = await giteaService.getOrganizations();
        return NextResponse.json({
          organizations: orgs,
          pagination: {
            total: orgs.length,
            page: 1,
            per_page: 50,
          },
        });
      }

      case 'commits': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const limit = parseInt(searchParams.get('limit') || '10');
        
        if (owner && repo) {
          const commits = await giteaService.getCommits(owner, repo, { limit });
          return NextResponse.json({
            commits,
            total: commits.length,
          });
        }

        // Get commits from all repos
        const repos = await giteaService.getRepositories();
        const allCommits: any[] = [];
        
        for (const repoData of repos.slice(0, 5)) {
          try {
            const [repoOwner, repoName] = repoData.full_name.split('/');
            const commits = await giteaService.getCommits(repoOwner, repoName, { limit: 3 });
            allCommits.push(...commits.map(c => ({
              ...c,
              repository: {
                name: repoData.name,
                full_name: repoData.full_name,
                html_url: repoData.html_url,
              }
            })));
          } catch (e) {
            // Skip repos with errors
          }
        }

        allCommits.sort((a, b) => 
          new Date(b.commit?.author?.date || b.created).getTime() - 
          new Date(a.commit?.author?.date || a.created).getTime()
        );

        return NextResponse.json({
          commits: allCommits.slice(0, limit),
          total: allCommits.length,
        });
      }

      case 'workflows': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const limit = parseInt(searchParams.get('limit') || '20');
        
        const runs = await giteaService.getWorkflowRuns({ owner: owner || undefined, repo: repo || undefined, limit });
        return NextResponse.json({
          workflow_runs: runs,
          total: runs.length,
        });
      }

      case 'branches': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        
        if (!owner || !repo) {
          return NextResponse.json({ error: 'Owner and repo required' }, { status: 400 });
        }
        
        const branches = await giteaService.getBranches(owner, repo);
        return NextResponse.json({ branches });
      }

      case 'pull_requests': {
        const owner = searchParams.get('owner');
        const repo = searchParams.get('repo');
        const state = (searchParams.get('state') as 'open' | 'closed' | 'all') || 'open';
        
        if (!owner || !repo) {
          return NextResponse.json({ error: 'Owner and repo required' }, { status: 400 });
        }
        
        const pullRequests = await giteaService.getPullRequests(owner, repo, state);
        return NextResponse.json({ pull_requests: pullRequests });
      }

      case 'stats': {
        const repos = await giteaService.getRepositories();
        const orgs = await giteaService.getOrganizations();
        const user = await giteaService.getCurrentUser();
        
        return NextResponse.json({
          counters: {
            repo: repos.length,
            org: orgs.length,
            user: user ? 1 : 0,
            star: repos.reduce((sum, r) => sum + (r.stars_count || 0), 0),
            issue: repos.reduce((sum, r) => sum + (r.open_issues_count || 0), 0),
          },
        });
      }

      case 'health': {
        const isHealthy = await giteaService.healthCheck();
        return NextResponse.json({
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime: 0,
          version: 'unknown',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown endpoint: ${endpoint}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error fetching Gitea data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Gitea data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, repository, owner, parameters = {} } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const validActions = ['create_repo', 'create_webhook', 'trigger_workflow', 'cancel_workflow'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const result: any = {
      action,
      success: true,
      timestamp: new Date().toISOString(),
      performedBy: session.user?.email || 'unknown',
    };

    switch (action) {
      case 'create_repo': {
        const { name, description, private: isPrivate = false } = parameters;
        if (!name) {
          return NextResponse.json({ error: 'Repository name required' }, { status: 400 });
        }
        
        try {
          const repo = await giteaClient.createRepository({
            name,
            description,
            private: isPrivate,
            auto_init: true,
          });
          result.repository = repo;
          result.message = `Repository '${name}' created successfully`;
        } catch (error) {
          return NextResponse.json({
            error: 'Failed to create repository',
            details: error instanceof Error ? error.message : 'Unknown error',
          }, { status: 500 });
        }
        break;
      }

      case 'create_webhook': {
        const { url, events = ['push', 'pull_request'] } = parameters;
        if (!url || !repository || !owner) {
          return NextResponse.json({ error: 'URL, owner, and repository required' }, { status: 400 });
        }
        
        const webhookResult = await giteaService.createWebhook(owner, repository, url, events);
        if (!webhookResult.success) {
          return NextResponse.json({
            error: 'Failed to create webhook',
            details: webhookResult.error,
          }, { status: 500 });
        }
        
        result.webhook = {
          id: webhookResult.id,
          repository: `${owner}/${repository}`,
          url,
          events,
        };
        result.message = `Webhook created for '${owner}/${repository}'`;
        break;
      }

      case 'trigger_workflow': {
        const { workflow_file, ref = 'main' } = parameters;
        if (!workflow_file || !repository || !owner) {
          return NextResponse.json({ error: 'Workflow file, owner, and repository required' }, { status: 400 });
        }
        
        const triggerResult = await giteaService.triggerWorkflow(owner, repository, workflow_file, {
          ref,
          environment: parameters.environment || 'production',
        });
        
        if (!triggerResult.success) {
          return NextResponse.json({
            error: 'Failed to trigger workflow',
            details: triggerResult.error,
          }, { status: 500 });
        }
        
        result.message = `Workflow '${workflow_file}' triggered for '${owner}/${repository}'`;
        break;
      }

      case 'cancel_workflow': {
        const { run_id } = parameters;
        if (!run_id || !repository || !owner) {
          return NextResponse.json({ error: 'Run ID, owner, and repository required' }, { status: 400 });
        }
        
        const cancelResult = await giteaService.cancelWorkflowRun(owner, repository, run_id);
        if (!cancelResult.success) {
          return NextResponse.json({
            error: 'Failed to cancel workflow',
            details: cancelResult.error,
          }, { status: 500 });
        }
        
        result.message = `Workflow run ${run_id} cancelled`;
        break;
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error executing Gitea action:', error);
    return NextResponse.json(
      { error: 'Failed to execute Gitea action', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
