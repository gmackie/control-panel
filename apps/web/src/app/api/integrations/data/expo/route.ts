import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { orgIntegrations, eq } from '@repo/db';
import { ExpoClient, ExpoBuild, ExpoSubmission, ExpoUpdate } from '@/lib/expo/client';

async function getExpoCredentials() {
  const envToken = process.env.EXPO_ACCESS_TOKEN;
  if (envToken) {
    return { accessToken: envToken };
  }

  const db = await getDbAsync();
  if (!db) return null;

  const [integration] = await db
    .select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.provider, 'expo'))
    .limit(1);

  if (!integration?.credentials) return null;

  const credentials = JSON.parse(integration.credentials);

  return {
    accessToken: credentials.accessToken || credentials.token || credentials.apiKey,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creds = await getExpoCredentials();
    if (!creds?.accessToken) {
      return NextResponse.json(
        { error: 'Expo not configured. Add EXPO_ACCESS_TOKEN env var or configure in Integrations Hub.' },
        { status: 404 }
      );
    }

    const client = new ExpoClient(creds.accessToken);

    const accounts = await client.getAccounts();

    let totalProjects = 0;
    let totalBuilds = 0;
    let totalSubmissions = 0;
    let totalUpdates = 0;
    const allPlatforms = new Set<string>();
    const buildStatuses: Record<string, number> = {};
    const submissionStatuses: Record<string, number> = {};

    const accountDetails = await Promise.all(
      accounts.map(async (account) => {
        const projects = await client.getProjects(account.name).catch(() => []);

        const projectDetails = await Promise.all(
          projects.slice(0, 15).map(async (project) => {
            const [builds, submissions, updates] = await Promise.all([
              client.getBuilds(project.id, { limit: 25 }).catch(() => [] as ExpoBuild[]),
              client.getSubmissions(project.id, { limit: 15 }).catch(() => [] as ExpoSubmission[]),
              client.getUpdates(project.id, { limit: 15 }).catch(() => [] as ExpoUpdate[]),
            ]);

            project.platforms?.forEach((p) => allPlatforms.add(p));
            builds.forEach((b) => {
              allPlatforms.add(b.platform);
              buildStatuses[b.status] = (buildStatuses[b.status] || 0) + 1;
            });
            submissions.forEach((s) => {
              submissionStatuses[s.status] = (submissionStatuses[s.status] || 0) + 1;
            });

            totalBuilds += builds.length;
            totalSubmissions += submissions.length;
            totalUpdates += updates.length;

            return {
              id: project.id,
              slug: project.slug,
              name: project.name,
              fullName: project.fullName,
              description: project.description,
              platforms: project.platforms,
              sdkVersion: project.sdkVersion,
              runtimeVersion: project.runtimeVersion,
              githubUrl: project.githubRepository?.url,
              iconUrl: project.icon?.url,
              privacySetting: project.privacySetting,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              builds: builds.map((b) => ({
                id: b.id,
                status: b.status,
                platform: b.platform,
                buildProfile: b.buildProfile,
                channel: b.channel,
                appVersion: b.appVersion,
                sdkVersion: b.sdkVersion,
                runtimeVersion: b.runtimeVersion,
                createdAt: b.createdAt,
                completedAt: b.completedAt,
                expirationDate: b.expirationDate,
                initiatedBy: b.initiatingActor?.username,
                error: b.error?.message,
                artifacts: b.artifacts,
              })),
              submissions: submissions.map((s) => ({
                id: s.id,
                status: s.status,
                platform: s.platform,
                createdAt: s.createdAt,
                completedAt: s.completedAt,
                submittedBuildId: s.submittedBuildId,
                error: s.error?.message,
              })),
              updates: updates.map((u) => ({
                id: u.id,
                group: u.group,
                platform: u.platform,
                message: u.message,
                branch: u.branch?.name,
                runtimeVersion: u.runtimeVersion,
                createdAt: u.createdAt,
                actor: u.actor?.username,
                gitCommitHash: u.gitCommitHash,
              })),
            };
          })
        );

        totalProjects += projects.length;

        return {
          id: account.id,
          name: account.name,
          owner: account.ownerUserActor?.username,
          projectCount: projects.length,
          projects: projectDetails,
        };
      })
    );

    const allBuilds = accountDetails.flatMap((a) =>
      a.projects.flatMap((p) => p.builds)
    );
    const allSubmissions = accountDetails.flatMap((a) =>
      a.projects.flatMap((p) => p.submissions)
    );

    const recentBuilds = allBuilds
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const activeBuilds = allBuilds.filter(
      (b) => b.status === 'in_progress' || b.status === 'in_queue' || b.status === 'new'
    );
    const failedBuilds = allBuilds.filter((b) => b.status === 'errored');
    const successfulBuilds = allBuilds.filter((b) => b.status === 'finished');

    const activeSubmissions = allSubmissions.filter(
      (s) => s.status === 'in_progress' || s.status === 'in_queue' || s.status === 'awaiting_build'
    );
    const failedSubmissions = allSubmissions.filter((s) => s.status === 'errored');

    return NextResponse.json({
      accounts: accountDetails,
      summary: {
        totalAccounts: accounts.length,
        totalProjects,
        totalBuilds,
        totalSubmissions,
        totalUpdates,
        platforms: Array.from(allPlatforms),
        platformCount: allPlatforms.size,
        buildStatuses,
        submissionStatuses,
        activeBuilds: activeBuilds.length,
        failedBuilds: failedBuilds.length,
        successfulBuilds: successfulBuilds.length,
        activeSubmissions: activeSubmissions.length,
        failedSubmissions: failedSubmissions.length,
        recentBuilds,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Expo data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Expo data' },
      { status: 500 }
    );
  }
}
