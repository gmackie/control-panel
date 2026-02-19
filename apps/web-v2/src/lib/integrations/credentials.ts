import { getDbAsync } from '@/lib/db';
import { orgIntegrations, eq } from '@repo/db';

export interface HetznerCredentials {
  id: string;
  name: string;
  apiToken: string;
  defaultLocation?: string;
}

export interface AWSCredentials {
  id?: string;
  name?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

export async function getHetznerCredentials(): Promise<HetznerCredentials | null> {
  const all = await getAllHetznerCredentials();
  return all.length > 0 ? all[0] : null;
}

export async function getAllHetznerCredentials(): Promise<HetznerCredentials[]> {
  const results: HetznerCredentials[] = [];

  const envToken = process.env.HETZNER_API_TOKEN;
  if (envToken) {
    results.push({
      id: 'env',
      name: 'Environment Variable',
      apiToken: envToken,
    });
  }

  try {
    const db = await getDbAsync();
    if (!db) return results;

    const integrations = await db
      .select()
      .from(orgIntegrations)
      .where(eq(orgIntegrations.provider, 'hetzner'));

    for (const integration of integrations) {
      if (!integration.credentials) continue;

      try {
        const credentials = JSON.parse(integration.credentials);
        const config = integration.config ? JSON.parse(integration.config) : {};

        if (credentials.apiToken) {
          results.push({
            id: integration.id,
            name: integration.name,
            apiToken: credentials.apiToken,
            defaultLocation: config.defaultLocation,
          });
        }
      } catch {
        console.error(`Failed to parse credentials for integration ${integration.id}`);
      }
    }
  } catch (error) {
    console.error('Failed to get Hetzner credentials:', error);
  }

  return results;
}

export async function getAWSCredentials(): Promise<AWSCredentials | null> {
  const envAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const envSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (envAccessKey && envSecretKey) {
    return {
      accessKeyId: envAccessKey,
      secretAccessKey: envSecretKey,
      sessionToken: process.env.AWS_SESSION_TOKEN,
      region: process.env.AWS_REGION || 'us-east-1',
    };
  }

  try {
    const db = await getDbAsync();
    if (!db) return null;

    const [integration] = await db
      .select()
      .from(orgIntegrations)
      .where(eq(orgIntegrations.provider, 'aws'))
      .limit(1);

    if (!integration?.credentials) return null;

    const credentials = JSON.parse(integration.credentials);
    const config = integration.config ? JSON.parse(integration.config) : {};

    if (!credentials.accessKeyId || !credentials.secretAccessKey) return null;

    return {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      region: config.region || 'us-east-1',
    };
  } catch (error) {
    console.error('Failed to get AWS credentials:', error);
    return null;
  }
}
