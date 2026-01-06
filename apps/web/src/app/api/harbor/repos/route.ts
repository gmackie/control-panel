import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { harborService } from '@/lib/harbor/service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repositories = await harborService.listAllRepositories();

    const result = repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      project: repo.project,
      description: repo.description,
      artifactCount: repo.artifactCount,
      pullCount: repo.pullCount,
      size: repo.size,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
      latestTag: repo.latestTag
        ? {
            name: repo.latestTag.name,
            pushedAt: repo.latestTag.pushedAt,
            size: repo.latestTag.size,
          }
        : null,
      tagCount: repo.tags.length,
      vulnerabilities: repo.vulnerabilities,
    }));

    return NextResponse.json({ repositories: result });
  } catch (error) {
    console.error('Error fetching Harbor repos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
