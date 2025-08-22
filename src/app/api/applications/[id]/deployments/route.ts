import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getApplication,
} from '@/lib/applications/manager';
import {
  createDeployment,
  getDeployments,
} from '@/lib/deployments/manager';
import { CreateDeploymentRequest } from '@/types/deployments';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const application = await getApplication(params.id);
    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Check ownership
    const userId = (session.user as any).login || session.user.email!;
    if (application.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const environment = searchParams.get('environment') as 'staging' | 'production' | null;

    const deployments = await getDeployments(params.id, environment || undefined);
    return NextResponse.json(deployments);
  } catch (error) {
    console.error('Error fetching deployments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const application = await getApplication(params.id);
    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Check ownership
    const userId = (session.user as any).login || session.user.email!;
    if (application.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: CreateDeploymentRequest = await request.json();
    
    if (!body.environment || !body.version || !body.commitSha || !body.imageTag) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const deployment = await createDeployment({
      ...body,
      applicationId: params.id,
    });

    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    console.error('Error creating deployment:', error);
    return NextResponse.json(
      { error: 'Failed to create deployment' },
      { status: 500 }
    );
  }
}