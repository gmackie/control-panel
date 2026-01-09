import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, eq } from '@repo/db';
import { GitHubClient, GitHubRepo, GitHubIssue, GitHubRelease } from '@/lib/github/client';

async function getGitHubCredentials() {
  const envToken = process.env.GITHUB_TOKEN;
  const envUsername = process.env.GITHUB_USERNAME;
  if (envToken) {
    return { token: envToken, username: envUsername };
  }

  const db = await getDbAsync();
  if (!db) return null;

  const [integration] = await db
    .select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.provider, 'github'))
    .limit(1);

  if (!integration?.credentials) return null;

  const credentials = JSON.parse(integration.credentials);

  return { 
    token: credentials.token || credentials.apiKey,
    username: credentials.username
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creds = await getGitHubCredentials();
    if (!creds?.token) {
      return NextResponse.json(
        { error: 'GitHub not configured. Add integration in Integrations Hub or set GITHUB_TOKEN env var.' },
        { status: 404 }
      );
    }

    const client = new GitHubClient({ token: creds.token, username: creds.username });

    const [user, repos, rateLimit] = await Promise.all([
      client.getCurrentUser(),
      client.getUserRepos(creds.username),
      client.getRateLimit(),
    ]);

    const topRepos = repos
      .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
      .slice(0, 10);

    const repoDetails = await Promise.all(
      topRepos.map(async (repo) => {
        const owner = repo.owner.login;
        const repoName = repo.name;

        const [issues, releases] = await Promise.all([
          client.listIssues(owner, repoName, { state: 'all', per_page: 10, sort: 'updated' }).catch(() => []),
          client.listReleases(owner, repoName, { per_page: 5 }).catch(() => []),
        ]);

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
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            open_issues_count: repo.open_issues_count,
            pushed_at: repo.pushed_at,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
          },
          issues: issues.map((issue: GitHubIssue) => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            state_reason: issue.state_reason,
            html_url: issue.html_url,
            user: issue.user?.login,
            assignee: issue.assignee?.login,
            labels: issue.labels.map(l => ({ name: l.name, color: l.color })),
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
          })),
          releases: releases.map((release: GitHubRelease) => ({
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

    const allIssues = repoDetails.flatMap(r => r.issues);
    const allReleases = repoDetails.flatMap(r => r.releases);
    const openIssues = allIssues.filter(i => i.state === 'open');
    const closedIssues = allIssues.filter(i => i.state === 'closed');

    const languageCounts: Record<string, number> = {};
    repos.forEach((repo: GitHubRepo) => {
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    });
    const languages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({ language, count }));

    const totalStars = repos.reduce((sum: number, r: GitHubRepo) => sum + r.stargazers_count, 0);
    const totalForks = repos.reduce((sum: number, r: GitHubRepo) => sum + r.forks_count, 0);
    const totalOpenIssues = repos.reduce((sum: number, r: GitHubRepo) => sum + r.open_issues_count, 0);

    const publicRepos = repos.filter((r: GitHubRepo) => !r.private);
    const privateRepos = repos.filter((r: GitHubRepo) => r.private);

    return NextResponse.json({
      user: user ? {
        login: user.login,
        id: user.id,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        name: user.name,
        company: user.company,
        location: user.location,
        email: user.email,
        bio: user.bio,
        public_repos: user.public_repos,
        followers: user.followers,
        following: user.following,
      } : null,
      repositories: repoDetails,
      allRepos: repos.map((repo: GitHubRepo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        pushed_at: repo.pushed_at,
        updated_at: repo.updated_at,
      })),
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: rateLimit.reset.toISOString(),
        resetIn: Math.max(0, Math.round((rateLimit.reset.getTime() - Date.now()) / 1000)),
      },
      summary: {
        totalRepos: repos.length,
        publicRepos: publicRepos.length,
        privateRepos: privateRepos.length,
        totalStars,
        totalForks,
        totalOpenIssues,
        totalIssuesFetched: allIssues.length,
        openIssuesFetched: openIssues.length,
        closedIssuesFetched: closedIssues.length,
        totalReleases: allReleases.length,
        languages,
        topLanguage: languages[0]?.language || null,
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          usagePercent: Math.round((1 - rateLimit.remaining / rateLimit.limit) * 100),
        },
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch GitHub data' },
      { status: 500 }
    );
  }
}
