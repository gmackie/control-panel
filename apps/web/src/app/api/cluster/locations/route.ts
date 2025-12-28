import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HetznerClient } from '@/lib/hetzner/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hetznerToken = process.env.HETZNER_API_TOKEN;
    if (!hetznerToken) {
      return NextResponse.json(
        { error: 'Hetzner API token not configured' },
        { status: 500 }
      );
    }

    const client = new HetznerClient(hetznerToken);
    const locations = await client.listLocations();

    return NextResponse.json(locations);
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}