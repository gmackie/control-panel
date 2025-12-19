import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { githubService } from '@/lib/github/github-service';
import { GiteaService } from '@/lib/gitea/gitea-service';

const giteaService = new GiteaService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const owner = searchParams.get('owner') || 'gmackie';
    const repo = searchParams.get('repo');

    switch (action) {
      case 'repositories': {
        const repos = await githubService.getRepositories(owner);
        
        // Enrich with workflow info
        const enrichedRepos = await Promise.all(
          repos.map(async (r) => {
            let workflows: Array<{ id: number; name: string; path: string }> = [];
            let recentCommits: Array<{
              sha: string;
              shortSha: string;
              message: string;
              author: string;
              date: string;
            }> = [];

            try {
              const wf = await githubService.getWorkflows(r.owner.login, r.name);
              workflows = wf.map(w => ({ id: w.id, name: w.name, path: w.path }));
            } catch {
              // No workflows
            }

            try {
              const commits = await githubService.getCommits(r.owner.login, r.name, { limit: 5 });
              recentCommits = commits.map(c => ({
                sha: c.sha,
                shortSha: c.sha.substring(0, 7),
                message: c.commit.message.split('\n')[0],
                author: c.commit.author.name,
                date: c.commit.author.date,
              }));
            } catch {
              // No commits
            }

            return {
              id: r.id,
              name: r.name,
              full_name: r.full_name,
              description: r.description,
              private: r.private,
              html_url: r.html_url,
              clone_url: r.clone_url,
              ssh_url: r.ssh_url,
              default_branch: r.default_branch,
              language: r.language,
              stars_count: r.stargazers_count,
              forks_count: r.forks_count,
              open_issues_count: r.open_issues_count,
              updated_at: r.updated_at,
              pushed_at: r.pushed_at,
              workflows,
              hasWorkflows: workflows.length > 0,
              recentCommits,
              actionsUrl: `https://github.com/${r.full_name}/actions`,
            };
          })
        );

        return NextResponse.json(enrichedRepos);
      }

      case 'commits': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository required' }, { status: 400 });
        }
        const commits = await githubService.getCommits(owner, repo, { limit: 20 });
        return NextResponse.json(commits);
      }

      case 'branches': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository required' }, { status: 400 });
        }
        const branches = await githubService.getBranches(owner, repo);
        return NextResponse.json(branches);
      }

      case 'workflows': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository required' }, { status: 400 });
        }
        const workflows = await githubService.getWorkflows(owner, repo);
        return NextResponse.json(workflows);
      }

      case 'workflow-runs': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository required' }, { status: 400 });
        }
        const runs = await githubService.getWorkflowRuns(owner, repo, { limit: 20 });
        return NextResponse.json(runs);
      }

      case 'cross-published': {
        // Find repos that exist on both GitHub and Gitea
        const giteaRepos = await giteaService.getRepositories(owner);
        const crossPublished = await githubService.findCrossPublishedRepos(giteaRepos);
        return NextResponse.json(crossPublished);
      }

      case 'stats': {
        const stats = await githubService.getRepoStats();
        return NextResponse.json(stats);
      }

      case 'rate-limit': {
        const rateLimit = await githubService.getRateLimit();
        return NextResponse.json(rateLimit);
      }

      case 'user': {
        const user = await githubService.getCurrentUser();
        return NextResponse.json(user);
      }

      default:
        // Return stats by default
        const stats = await githubService.getRepoStats();
        return NextResponse.json(stats);
    }
  } catch (error: unknown) {
    console.error('Error in GitHub API:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch GitHub data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, owner, repo, workflowId, ref, inputs } = body;

    switch (action) {
      case 'trigger-workflow': {
        if (!owner || !repo || !workflowId) {
          return NextResponse.json(
            { error: 'Missing required parameters: owner, repo, workflowId' },
            { status: 400 }
          );
        }

        const result = await githubService.triggerWorkflow(
          owner,
          repo,
          workflowId,
          ref || 'main',
          inputs
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Failed to trigger workflow' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Workflow triggered on ${ref || 'main'}`,
          actionsUrl: `https://github.com/${owner}/${repo}/actions`,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error in GitHub API:', error);
    const message = error instanceof Error ? error.message : 'Failed to perform action';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
