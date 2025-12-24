import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getApplication,
  createSecret,
  getSecrets 
} from '@/lib/applications/manager';
import { CreateSecretRequest } from '@/types/applications';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
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

    const secrets = await getSecrets(params.id);
    return NextResponse.json(secrets);
  } catch (error) {
    console.error('Error fetching secrets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch secrets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
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

    const body: CreateSecretRequest = await request.json();
    
    if (!body.key || !body.value) {
      return NextResponse.json(
        { error: 'Secret key and value are required' },
        { status: 400 }
      );
    }

    const secret = await createSecret(params.id, body);

    if (!secret) {
      return NextResponse.json(
        { error: 'Failed to create secret' },
        { status: 500 }
      );
    }

    return NextResponse.json(secret, { status: 201 });
  } catch (error) {
    console.error('Error creating secret:', error);
    return NextResponse.json(
      { error: 'Failed to create secret' },
      { status: 500 }
    );
  }
}