import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HetznerClient } from '@/lib/hetzner/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { nodeName, action } = body;

    if (!nodeName || !action) {
      return NextResponse.json(
        { error: 'Node name and action are required' },
        { status: 400 }
      );
    }

    const hetznerToken = process.env.HETZNER_API_TOKEN;
    if (!hetznerToken) {
      return NextResponse.json(
        { error: 'Hetzner API token not configured' },
        { status: 500 }
      );
    }

    const client = new HetznerClient(hetznerToken);
    
    // Find the server by name
    const servers = await client.listServers(`name=${nodeName}`);
    if (servers.length === 0) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    const serverId = servers[0].id;

    switch (action) {
      case 'reboot':
        await client.rebootServer(serverId);
        break;
      case 'poweroff':
        await client.powerOffServer(serverId);
        break;
      case 'poweron':
        await client.powerOnServer(serverId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ 
      message: `Power action ${action} initiated for ${nodeName}` 
    });
  } catch (error: any) {
    console.error('Error performing power action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform power action' },
      { status: 500 }
    );
  }
}