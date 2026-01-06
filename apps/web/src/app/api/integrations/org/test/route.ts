import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function testVercel(token: string, teamId?: string) {
  const url = teamId 
    ? `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=1`
    : 'https://api.vercel.com/v9/projects?limit=1';
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Vercel API error: ${response.status}`);
  }
  
  return { success: true, message: 'Connected to Vercel successfully' };
}

async function testExpo(token: string) {
  const response = await fetch('https://api.expo.dev/v2/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) {
    throw new Error(`Expo API error: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, message: `Connected as ${data.data?.username || 'user'}` };
}

async function testNeon(apiKey: string) {
  const response = await fetch('https://console.neon.tech/api/v2/projects?limit=1', {
    headers: { 
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Neon API error: ${response.status}`);
  }
  
  return { success: true, message: 'Connected to Neon successfully' };
}

async function testGitHub(token: string, org?: string) {
  const url = org ? `https://api.github.com/orgs/${org}` : 'https://api.github.com/user';
  
  const response = await fetch(url, {
    headers: { 
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, message: `Connected as ${data.login || data.name}` };
}

async function testGitea(token: string, url: string) {
  const apiUrl = `${url.replace(/\/$/, '')}/api/v1/user`;
  
  const response = await fetch(apiUrl, {
    headers: { Authorization: `token ${token}` },
  });
  
  if (!response.ok) {
    throw new Error(`Gitea API error: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, message: `Connected as ${data.login || data.username}` };
}

async function testTurso(apiToken: string, organization?: string) {
  const url = organization 
    ? `https://api.turso.tech/v1/organizations/${organization}/databases`
    : 'https://api.turso.tech/v1/databases';
  
  const response = await fetch(url, {
    headers: { 
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Turso API error: ${response.status}`);
  }
  
  const data = await response.json();
  const dbCount = data.databases?.length || 0;
  return { success: true, message: `Connected to Turso (${dbCount} database${dbCount !== 1 ? 's' : ''} found)` };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, credentials, config } = body;

    if (!provider || !credentials) {
      return NextResponse.json({ error: 'Provider and credentials required' }, { status: 400 });
    }

    let result;

    switch (provider) {
      case 'vercel':
        if (!credentials.token) throw new Error('Vercel token required');
        result = await testVercel(credentials.token, config?.teamId);
        break;
      case 'expo':
        if (!credentials.token) throw new Error('Expo token required');
        result = await testExpo(credentials.token);
        break;
      case 'neon':
        if (!credentials.apiKey) throw new Error('Neon API key required');
        result = await testNeon(credentials.apiKey);
        break;
      case 'github':
        if (!credentials.token) throw new Error('GitHub token required');
        result = await testGitHub(credentials.token, config?.org);
        break;
      case 'gitea':
        if (!credentials.token || !credentials.url) throw new Error('Gitea token and URL required');
        result = await testGitea(credentials.token, credentials.url);
        break;
      case 'turso':
        if (!credentials.apiToken) throw new Error('Turso API token required');
        result = await testTurso(credentials.apiToken, config?.organization);
        break;
      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Integration test failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 400 }
    );
  }
}
