/**
 * Vercel Environment Variable Sync
 *
 * Syncs secrets to Vercel project env vars.
 * Vercel env vars are immutable — update requires delete + create.
 * Rate limit: ~100 req/min → sequential with 600ms delay.
 */

const VERCEL_API = "https://api.vercel.com";
const DELAY_MS = 600; // Rate limit safety

interface VercelEnvVar {
  id: string;
  key: string;
  value: string;
  target: string[];
  type: "encrypted" | "plain" | "sensitive";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncToVercel(
  token: string,
  projectId: string,
  secrets: Record<string, string>,
  target: "production" | "preview" | "development" = "production",
  teamId?: string
): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const teamParam = teamId ? `?teamId=${teamId}` : "";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1. List existing env vars
  const listRes = await fetch(
    `${VERCEL_API}/v10/projects/${projectId}/env${teamParam}`,
    { headers }
  );

  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Failed to list Vercel env vars: ${listRes.status} ${err}`);
  }

  const { envs } = (await listRes.json()) as { envs: VercelEnvVar[] };
  const existingByKey = new Map(envs.map((e) => [e.key, e]));

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  // 2. For each secret, delete existing + create new (sequential with delay)
  for (const [key, value] of Object.entries(secrets)) {
    try {
      const existing = existingByKey.get(key);

      // Delete existing if present
      if (existing) {
        const delRes = await fetch(
          `${VERCEL_API}/v10/projects/${projectId}/env/${existing.id}${teamParam}`,
          { method: "DELETE", headers }
        );
        if (!delRes.ok && delRes.status !== 404) {
          const err = await delRes.text();
          errors.push(`Delete ${key}: ${delRes.status} ${err}`);
          failed++;
          await delay(DELAY_MS);
          continue;
        }
        await delay(DELAY_MS);
      }

      // Create new
      const createRes = await fetch(
        `${VERCEL_API}/v10/projects/${projectId}/env${teamParam}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            key,
            value,
            target: [target],
            type: "encrypted",
          }),
        }
      );

      if (!createRes.ok) {
        const err = await createRes.text();
        errors.push(`Create ${key}: ${createRes.status} ${err}`);
        failed++;
      } else {
        synced++;
      }

      await delay(DELAY_MS);
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : "Unknown error"}`);
      failed++;
    }
  }

  return { synced, failed, errors };
}
