import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { clerkService } from '@/lib/clerk/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    switch (action) {
      case 'stats':
        const stats = await clerkService.getDashboardStats();
        return NextResponse.json(stats);

      case 'users':
        const users = await clerkService.getUsers({ limit });
        return NextResponse.json({ users });

      case 'user':
        if (!userId) {
          return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }
        const user = await clerkService.getUser(userId);
        return NextResponse.json(user);

      case 'user-count':
        const count = await clerkService.getUserCount();
        return NextResponse.json({ count });

      case 'sessions':
        const sessions = await clerkService.getActiveSessions();
        return NextResponse.json({ sessions });

      case 'organizations':
        const orgs = await clerkService.getOrganizations();
        return NextResponse.json({ organizations: orgs });

      case 'health':
        const healthy = await clerkService.healthCheck();
        return NextResponse.json({ healthy, service: 'clerk' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Clerk API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, userId, sessionId } = body;

    switch (action) {
      case 'ban-user':
        if (!userId) {
          return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }
        const bannedUser = await clerkService.banUser(userId);
        return NextResponse.json({ user: bannedUser, action: 'banned' });

      case 'unban-user':
        if (!userId) {
          return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }
        const unbannedUser = await clerkService.unbanUser(userId);
        return NextResponse.json({ user: unbannedUser, action: 'unbanned' });

      case 'revoke-session':
        if (!sessionId) {
          return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }
        const revokedSession = await clerkService.revokeSession(sessionId);
        return NextResponse.json({ session: revokedSession, action: 'revoked' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Clerk API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
