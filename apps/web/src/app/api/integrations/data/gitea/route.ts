import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, eq } from '@repo/db';
import {
  GiteaClient,
  GiteaRepository,
  GiteaPullRequest,
  GiteaIssue,
  GiteaWorkflowRun,
  GiteaRelease,
} from '@/lib/gitea/client';

interface GiteaCredentials {
  baseUrl: string;
  token: string;
}

async function getGiteaCredentials(): Promise<GiteaCredentials | null> {
  const envUrl = process.env.GITEA_URL;
  const envToken = process.env.GITEA_TOKEN;
  
  if (envUrl && envToken) {
    return { baseUrl: envUrl, token: envToken };
  }

  const db = await getDbAsync();
  if (!db) return null;

  const [integration] = await db
    .select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.provider, 'gitea'))
    .limit(1);

  if (!integration?.credentials) return null;

  const credentials = JSON.parse(integration.credentials);
  const config = integration.config ? JSON.parse(integration.config) : {};

  return {
    baseUrl: credentials.baseUrl || config.baseUrl,
    token: credentials.token || credentials.apiKey,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creds = await getGiteaCredentials();
    if (!creds?.baseUrl || !creds?.token) {
      return NextResponse.json(
        { error: 'Gitea not configured. Add integration in Integrations Hub or set GITEA_URL and GITEA_TOKEN env vars.' },
        { status: 404 }
      );
    }

    const client = new GiteaClient({ baseUrl: creds.baseUrl, token: creds.token });

    const [user, reposResult] = await Promise.all([
      client.getCurrentUser().catch(() => null),
      client.listRepositories({ limit: 100 }),
    ]);

    const repos: GiteaRepository[] = Array.isArray(reposResult) 
      ? reposResult 
      : (reposResult as any)?.data || [];

    const sortedRepos = [...repos].sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const topRepos = sortedRepos.slice(0, 10);

    const repoDetails = await Promise.all(
      topRepos.map(async (repo) => {
        const owner = repo.owner.login;
        const repoName = repo.name;

        const [workflowResult, pullRequests, issues, releases] = await Promise.all([
          client.listWorkflowRuns(owner, repoName, { limit: 10 }).catch(() => ({ workflow_runs: [] })),
          client.listPullRequests(owner, repoName, { state: 'all', limit: 10 }).catch(() => []),
          client.listIssues(owner, repoName, { state: 'all', limit: 10 }).catch(() => []),
          client.listReleases(owner, repoName, { limit: 5 }).catch(() => []),
        ]);

        const workflowRuns = workflowResult?.workflow_runs || [];

        return {
          repo: {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            private: repo.private,
            html_url: repo.html_url,
            clone_url: repo.clone_url,
            default_branch: repo.default_branch,
            language: repo.language,
            stars_count: repo.stars_count,
            forks_count: repo.forks_count,
            open_issues_count: repo.open_issues_count,
            open_pr_counter: repo.open_pr_counter,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
          },
          workflowRuns: workflowRuns.map((run: GiteaWorkflowRun) => ({
            id: run.id,
            run_number: run.run_number,
            workflow_name: run.workflow_name,
            status: run.status,
            conclusion: run.conclusion,
            event: run.event,
            head_branch: run.head_branch,
            html_url: run.html_url,
            created_at: run.created_at,
            updated_at: run.updated_at,
            actor: run.actor?.login,
            commit_message: run.commit?.message,
          })),
          pullRequests: pullRequests.map((pr: GiteaPullRequest) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            html_url: pr.html_url,
            user: pr.user?.login,
            assignee: pr.assignee?.login,
            labels: pr.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
            mergeable: pr.mergeable,
            merged: pr.merged,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            closed_at: pr.closed_at,
            merged_at: pr.merged_at,
          })),
          issues: issues.map((issue: GiteaIssue) => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            html_url: issue.html_url,
            user: issue.user?.login,
            assignee: issue.assignee?.login,
            labels: issue.labels?.map((l) => ({ name: l.name, color: l.color })) || [],
            comments: issue.comments,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
          })),
          releases: releases.map((release: GiteaRelease) => ({
            id: release.id,
            tag_name: release.tag_name,
            name: release.name,
            draft: release.draft,
            prerelease: release.prerelease,
            html_url: release.html_url,
            created_at: release.created_at,
            published_at: release.published_at,
            author: release.author?.login,
            assets_count: release.assets?.length || 0,
          })),
        };
      })
    );

    const allWorkflowRuns = repoDetails.flatMap(r => r.workflowRuns);
    const allPullRequests = repoDetails.flatMap(r => r.pullRequests);
    const allIssues = repoDetails.flatMap(r => r.issues);
    const allReleases = repoDetails.flatMap(r => r.releases);

    const workflowStats = {
      total: allWorkflowRuns.length,
      success: allWorkflowRuns.filter(r => r.conclusion === 'success').length,
      failure: allWorkflowRuns.filter(r => r.conclusion === 'failure').length,
      inProgress: allWorkflowRuns.filter(r => r.status === 'in_progress').length,
      queued: allWorkflowRuns.filter(r => r.status === 'queued').length,
    };

    const openPRs = allPullRequests.filter(pr => pr.state === 'open');
    const mergedPRs = allPullRequests.filter(pr => pr.merged);

    const openIssues = allIssues.filter(i => i.state === 'open');
    const closedIssues = allIssues.filter(i => i.state === 'closed');

    const languageCounts: Record<string, number> = {};
    repos.forEach((repo) => {
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    });
    const languages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({ language, count }));

    const totalStars = repos.reduce((sum, r) => sum + (r.stars_count || 0), 0);
    const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
    const totalOpenIssues = repos.reduce((sum, r) => sum + (r.open_issues_count || 0), 0);
    const totalOpenPRs = repos.reduce((sum, r) => sum + (r.open_pr_counter || 0), 0);

    const publicRepos = repos.filter(r => !r.private);
    const privateRepos = repos.filter(r => r.private);

    return NextResponse.json({
      user: user ? {
        id: user.id,
        login: user.login,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        email: user.email,
      } : null,
      serverUrl: creds.baseUrl,
      repositories: repoDetails,
      allRepos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        language: repo.language,
        stars_count: repo.stars_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        open_pr_counter: repo.open_pr_counter,
        updated_at: repo.updated_at,
      })),
      summary: {
        totalRepos: repos.length,
        publicRepos: publicRepos.length,
        privateRepos: privateRepos.length,
        totalStars,
        totalForks,
        totalOpenIssues,
        totalOpenPRs,
        totalIssuesFetched: allIssues.length,
        openIssuesFetched: openIssues.length,
        closedIssuesFetched: closedIssues.length,
        totalPRsFetched: allPullRequests.length,
        openPRsFetched: openPRs.length,
        mergedPRsFetched: mergedPRs.length,
        totalReleases: allReleases.length,
        languages,
        topLanguage: languages[0]?.language || null,
        workflowStats,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Gitea data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Gitea data' },
      { status: 500 }
    );
  }
}
