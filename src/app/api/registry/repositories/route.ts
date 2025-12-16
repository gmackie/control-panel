import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { harborService } from '@/lib/harbor/service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');
    const repo = searchParams.get('repo');

    // Get specific repository details
    if (project && repo) {
      const repository = await harborService.getRepository(project, repo);
      return NextResponse.json(repository);
    }

    // List all repositories
    const repositories = await harborService.listAllRepositories();
    return NextResponse.json(repositories);
  } catch (error: unknown) {
    console.error('Error fetching repositories:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch repositories';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');
    const repository = searchParams.get('repository');
    const tag = searchParams.get('tag');
    const digest = searchParams.get('digest');

    if (!project || !repository) {
      return NextResponse.json(
        { error: 'Missing required parameters: project and repository' },
        { status: 400 }
      );
    }

    if (!tag && !digest) {
      return NextResponse.json(
        { error: 'Must provide either tag or digest to delete' },
        { status: 400 }
      );
    }

    const reference = digest || tag!;
    
    if (tag) {
      // Delete specific tag
      await harborService.deleteTag(project, repository, reference, tag);
    }

    return NextResponse.json({ success: true, deleted: { project, repository, tag, digest } });
  } catch (error: unknown) {
    console.error('Error deleting image:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete image';
    return NextResponse.json(
      { error: message },
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
    const { action, project, repository, reference, tag } = body;

    if (!project || !repository || !reference) {
      return NextResponse.json(
        { error: 'Missing required parameters: project, repository, and reference' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'scan':
        await harborService.scanArtifact(project, repository, reference);
        return NextResponse.json({ success: true, message: 'Scan triggered' });

      case 'tag':
        if (!tag) {
          return NextResponse.json({ error: 'Missing tag name' }, { status: 400 });
        }
        await harborService.addTag(project, repository, reference, tag);
        return NextResponse.json({ success: true, message: `Tag ${tag} added` });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error in repository action:', error);
    const message = error instanceof Error ? error.message : 'Failed to perform action';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
