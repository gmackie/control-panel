import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

interface SecretData {
  id: string;
  name: string;
  environment: string;
  description: string | null;
  maskedValue: string;
  isRotating: boolean | null;
  lastRotatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

function generateMockSecrets(appId: string): SecretData[] {
  const now = new Date();
  return [
    {
      id: `${appId}-secret-1`,
      name: 'DATABASE_URL',
      environment: 'all',
      description: 'Database connection string',
      maskedValue: '••••••••••••',
      isRotating: false,
      lastRotatedAt: null,
      expiresAt: null,
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'admin@gmac.io'
    },
    {
      id: `${appId}-secret-2`,
      name: 'API_SECRET_KEY',
      environment: 'production',
      description: 'API authentication key',
      maskedValue: '••••••••••••',
      isRotating: true,
      lastRotatedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'admin@gmac.io'
    }
  ];
}

export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secrets = generateMockSecrets(params.id);
    
    return NextResponse.json({
      success: true,
      data: secrets,
      count: secrets.length
    });
  } catch (error) {
    console.error('Error fetching secrets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch secrets' },
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

    const body = await request.json();
    const { name, value, environment = 'all', description } = body;
    
    if (!name || !value) {
      return NextResponse.json(
        { success: false, error: 'Name and value are required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const newSecret: SecretData = {
      id: `${params.id}-secret-${Date.now()}`,
      name: name.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      environment,
      description: description || null,
      maskedValue: '••••••••••••',
      isRotating: null,
      lastRotatedAt: null,
      expiresAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: session.user.email || 'unknown'
    };

    return NextResponse.json({
      success: true,
      data: newSecret,
      message: 'Secret created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating secret:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create secret' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const environment = searchParams.get('environment');

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Secret name is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Secret ${name} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting secret:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete secret' },
      { status: 500 }
    );
  }
}
