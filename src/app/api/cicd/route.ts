import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
        // Get all repositories with workflow info
        const repos = await giteaService.getRepositories(owner);
        
        // Enrich with workflow and recent commit info
        const enrichedRepos = await Promise.all(
          repos.map(async (r) => {
            const [repoOwner, repoName] = r.full_name.split('/');
            
            // Get workflows
            let workflows: string[] = [];
            try {
              const workflowsResponse = await fetch(
                `${process.env.GITEA_URL || 'https://git.gmac.io'}/api/v1/repos/${repoOwner}/${repoName}/contents/.gitea/workflows`,
                {
                  headers: {
                    'Authorization': `token ${process.env.GITEA_TOKEN}`,
                  },
                }
              );
              if (workflowsResponse.ok) {
                const files = await workflowsResponse.json();
                workflows = files.map((f: { name: string }) => f.name);
              }
            } catch {
              // No workflows
            }

            // Get recent commits
            let recentCommits: Array<{
              sha: string;
              shortSha: string;
              message: string;
              author: string;
              date: string;
            }> = [];
            try {
              const commits = await giteaService.getCommits(repoOwner, repoName, { limit: 5 });
              recentCommits = commits.map(c => ({
                sha: c.sha,
                shortSha: c.sha.substring(0, 7),
                message: c.commit?.message?.split('\n')[0] || '',
                author: c.commit?.author?.name || c.author?.login || 'Unknown',
                date: c.commit?.author?.date || c.created,
              }));
            } catch {
              // No commits
            }

            return {
              ...r,
              workflows,
              hasWorkflows: workflows.length > 0,
              recentCommits,
              actionsUrl: `${process.env.GITEA_URL || 'https://git.gmac.io'}/${r.full_name}/actions`,
            };
          })
        );

        return NextResponse.json(enrichedRepos);
      }

      case 'commits': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository required' }, { status: 400 });
        }
        const commits = await giteaService.getCommits(owner, repo, { limit: 20 });
        return NextResponse.json(commits);
      }

      case 'branches': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository required' }, { status: 400 });
        }
        const branches = await giteaService.getBranches(owner, repo);
        return NextResponse.json(branches);
      }

      case 'workflows': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository required' }, { status: 400 });
        }
        
        // Get workflow files
        const workflowsResponse = await fetch(
          `${process.env.GITEA_URL || 'https://git.gmac.io'}/api/v1/repos/${owner}/${repo}/contents/.gitea/workflows`,
          {
            headers: {
              'Authorization': `token ${process.env.GITEA_TOKEN}`,
            },
          }
        );

        if (!workflowsResponse.ok) {
          return NextResponse.json([]);
        }

        const files = await workflowsResponse.json();
        
        // Get content of each workflow
        const workflows = await Promise.all(
          files.map(async (f: { name: string; path: string }) => {
            try {
              const contentResponse = await fetch(
                `${process.env.GITEA_URL || 'https://git.gmac.io'}/api/v1/repos/${owner}/${repo}/contents/${f.path}`,
                {
                  headers: {
                    'Authorization': `token ${process.env.GITEA_TOKEN}`,
                  },
                }
              );
              
              if (contentResponse.ok) {
                const content = await contentResponse.json();
                const yaml = Buffer.from(content.content, 'base64').toString('utf-8');
                
                // Parse triggers from yaml
                const hasWorkflowDispatch = yaml.includes('workflow_dispatch');
                const hasPush = yaml.includes('push:');
                const hasPullRequest = yaml.includes('pull_request:');
                
                return {
                  name: f.name.replace('.yml', '').replace('.yaml', ''),
                  file: f.name,
                  path: f.path,
                  triggers: {
                    workflow_dispatch: hasWorkflowDispatch,
                    push: hasPush,
                    pull_request: hasPullRequest,
                  },
                };
              }
            } catch {
              // Skip
            }
            
            return {
              name: f.name.replace('.yml', '').replace('.yaml', ''),
              file: f.name,
              path: f.path,
              triggers: {},
            };
          })
        );

        return NextResponse.json(workflows);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error in CI/CD API:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch CI/CD data';
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
    const { action, owner, repo, workflow, ref, inputs } = body;

    switch (action) {
      case 'trigger': {
        if (!owner || !repo || !workflow) {
          return NextResponse.json(
            { error: 'Missing required parameters: owner, repo, workflow' },
            { status: 400 }
          );
        }

        // Trigger workflow dispatch
        const response = await fetch(
          `${process.env.GITEA_URL || 'https://git.gmac.io'}/api/v1/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${process.env.GITEA_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ref: ref || 'main',
              inputs: inputs || {},
            }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json(
            { error: `Failed to trigger workflow: ${error}` },
            { status: response.status }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Workflow ${workflow} triggered on ${ref || 'main'}`,
          actionsUrl: `${process.env.GITEA_URL || 'https://git.gmac.io'}/${owner}/${repo}/actions`,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error in CI/CD API:', error);
    const message = error instanceof Error ? error.message : 'Failed to perform action';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
