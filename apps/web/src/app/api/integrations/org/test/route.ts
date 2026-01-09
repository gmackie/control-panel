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
  const response = await fetch('https://api.expo.dev/v2/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo API error: ${response.status} - ${text.slice(0, 100)}`);
  }
  
  const data = await response.json();
  return { success: true, message: `Connected as ${data.data?.username || data.data?.email || 'user'}` };
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

async function testHetzner(apiToken: string) {
  const response = await fetch('https://api.hetzner.cloud/v1/servers?per_page=1', {
    headers: { 
      Authorization: `Bearer ${apiToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Hetzner API error: ${response.status}`);
  }
  
  const data = await response.json();
  const serverCount = data.meta?.pagination?.total_entries || 0;
  return { success: true, message: `Connected to Hetzner Cloud (${serverCount} server${serverCount !== 1 ? 's' : ''} found)` };
}

async function testAWS(accessKeyId: string, secretAccessKey: string, sessionToken?: string, region: string = 'us-east-1') {
  const service = 'sts';
  const host = `${service}.${region}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const canonicalQuerystring = 'Action=GetCallerIdentity&Version=2011-06-15';
  
  const headersList = ['host', 'x-amz-date'];
  if (sessionToken) headersList.push('x-amz-security-token');
  headersList.sort();
  
  let canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  if (sessionToken) {
    canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\nx-amz-security-token:${sessionToken}\n`;
  }
  const signedHeaders = headersList.join(';');
  const payloadHash = await sha256('');
  
  const canonicalRequest = [
    'GET',
    '/',
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const headers: Record<string, string> = {
    'Host': host,
    'X-Amz-Date': amzDate,
    'Authorization': authorizationHeader,
  };
  
  if (sessionToken) {
    headers['X-Amz-Security-Token'] = sessionToken;
  }
  
  const response = await fetch(`${endpoint}?${canonicalQuerystring}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AWS STS error: ${response.status} - ${text.slice(0, 200)}`);
  }
  
  const text = await response.text();
  const arnMatch = text.match(/<Arn>([^<]+)<\/Arn>/);
  const accountMatch = text.match(/<Account>([^<]+)<\/Account>/);
  
  return { 
    success: true, 
    message: `Connected to AWS (Account: ${accountMatch?.[1] || 'unknown'})` 
  };
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function hmacHex(key: ArrayBuffer, message: string): Promise<string> {
  const result = await hmac(key, message);
  return Array.from(new Uint8Array(result))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${key}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
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
      case 'hetzner':
        if (!credentials.apiToken) throw new Error('Hetzner API token required');
        result = await testHetzner(credentials.apiToken);
        break;
      case 'aws':
        if (!credentials.accessKeyId || !credentials.secretAccessKey) {
          throw new Error('AWS Access Key ID and Secret Access Key required');
        }
        result = await testAWS(credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken, config?.region || 'us-east-1');
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
