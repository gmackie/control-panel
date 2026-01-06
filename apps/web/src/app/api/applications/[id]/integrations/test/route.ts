import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function testStripe(secretKey: string) {
  const response = await fetch('https://api.stripe.com/v1/balance', {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Stripe API error: ${response.status}`);
  }
  
  const data = await response.json();
  const isLive = secretKey.startsWith('sk_live');
  return { success: true, message: `Connected to Stripe (${isLive ? 'Live' : 'Test'} mode)` };
}

async function testClerk(secretKey: string) {
  const response = await fetch('https://api.clerk.com/v1/users?limit=1', {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  
  if (!response.ok) {
    throw new Error(`Clerk API error: ${response.status}`);
  }
  
  return { success: true, message: 'Connected to Clerk successfully' };
}

async function testSupabase(url: string, anonKey: string) {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { 
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  
  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase API error: ${response.status}`);
  }
  
  return { success: true, message: 'Connected to Supabase successfully' };
}

async function testSentry(authToken: string, org: string) {
  const response = await fetch(`https://sentry.io/api/0/organizations/${org}/`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  
  if (!response.ok) {
    throw new Error(`Sentry API error: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, message: `Connected to Sentry org: ${data.name || org}` };
}

async function testPostHog(apiKey: string, host?: string) {
  const baseUrl = host || 'https://app.posthog.com';
  const response = await fetch(`${baseUrl}/api/projects/`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  
  if (!response.ok) {
    throw new Error(`PostHog API error: ${response.status}`);
  }
  
  const data = await response.json();
  const projectCount = data.results?.length || 0;
  return { success: true, message: `Connected to PostHog (${projectCount} projects)` };
}

async function testSendGrid(apiKey: string) {
  const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  
  if (!response.ok) {
    throw new Error(`SendGrid API error: ${response.status}`);
  }
  
  return { success: true, message: 'Connected to SendGrid successfully' };
}

async function testResend(apiKey: string) {
  const response = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  
  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status}`);
  }
  
  return { success: true, message: 'Connected to Resend successfully' };
}

async function testTwilio(accountSid: string, authToken: string) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
    headers: { 
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Twilio API error: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, message: `Connected to Twilio (${data.friendly_name || accountSid})` };
}

async function testOpenRouter(apiKey: string) {
  const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }
  
  return { success: true, message: 'Connected to OpenRouter successfully' };
}

async function testElevenLabs(apiKey: string) {
  const response = await fetch('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': apiKey },
  });
  
  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }
  
  const data = await response.json();
  return { success: true, message: `Connected as ${data.subscription?.tier || 'user'}` };
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
      case 'stripe':
        if (!credentials.secretKey) throw new Error('Stripe secret key required');
        result = await testStripe(credentials.secretKey);
        break;
      case 'clerk':
        if (!credentials.secretKey) throw new Error('Clerk secret key required');
        result = await testClerk(credentials.secretKey);
        break;
      case 'supabase':
        if (!credentials.url || !credentials.anonKey) throw new Error('Supabase URL and anon key required');
        result = await testSupabase(credentials.url, credentials.anonKey);
        break;
      case 'sentry':
        if (!credentials.authToken || !config?.org) throw new Error('Sentry auth token and org required');
        result = await testSentry(credentials.authToken, config.org);
        break;
      case 'posthog':
        if (!credentials.apiKey) throw new Error('PostHog API key required');
        result = await testPostHog(credentials.apiKey, config?.host);
        break;
      case 'sendgrid':
        if (!credentials.apiKey) throw new Error('SendGrid API key required');
        result = await testSendGrid(credentials.apiKey);
        break;
      case 'resend':
        if (!credentials.apiKey) throw new Error('Resend API key required');
        result = await testResend(credentials.apiKey);
        break;
      case 'twilio':
        if (!credentials.accountSid || !credentials.authToken) throw new Error('Twilio account SID and auth token required');
        result = await testTwilio(credentials.accountSid, credentials.authToken);
        break;
      case 'openrouter':
        if (!credentials.apiKey) throw new Error('OpenRouter API key required');
        result = await testOpenRouter(credentials.apiKey);
        break;
      case 'elevenlabs':
        if (!credentials.apiKey) throw new Error('ElevenLabs API key required');
        result = await testElevenLabs(credentials.apiKey);
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
