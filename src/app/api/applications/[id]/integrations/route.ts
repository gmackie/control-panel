import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getApplication,
  updateApplication,
} from '@/lib/applications/manager';
import { ApplicationIntegration } from '@/types/applications';

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

    return NextResponse.json(application.integrations);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
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

    const body = await request.json();
    
    const newIntegration: ApplicationIntegration = {
      id: Math.random().toString(36).substr(2, 9),
      provider: body.provider,
      name: body.name,
      enabled: body.enabled ?? true,
      config: body.config || {},
      secrets: body.secrets || [],
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
    };

    const updatedApplication = await updateApplication(params.id, {
      integrations: [...application.integrations, newIntegration],
    });

    if (!updatedApplication) {
      return NextResponse.json(
        { error: 'Failed to add integration' },
        { status: 500 }
      );
    }

    return NextResponse.json(newIntegration, { status: 201 });
  } catch (error) {
    console.error('Error adding integration:', error);
    return NextResponse.json(
      { error: 'Failed to add integration' },
      { status: 500 }
    );
  }
}