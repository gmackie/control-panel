import { Secret } from "@/types";

interface K3sSecret {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
    annotations?: {
      "secret-rotation/last-rotated"?: string;
      "secret-rotation/expires"?: string;
    };
  };
  type: string;
  data: Record<string, string>;
}

export async function getK3sSecrets(): Promise<Secret[]> {
  const secrets: Secret[] = [];
  
  try {
    // Check if we have k3s access token
    const k3sToken = process.env.K3S_SA_TOKEN;
    const k3sApiUrl = process.env.K3S_API_URL || "https://k3s.gmac.io:6443";
    
    if (!k3sToken) {
      console.warn("K3S_SA_TOKEN not configured, returning mock data");
      return getMockSecrets();
    }
    
    // Fetch secrets from k3s API
    const response = await fetch(`${k3sApiUrl}/api/v1/secrets`, {
      headers: {
        "Authorization": `Bearer ${k3sToken}`,
        "Accept": "application/json",
      },
      // Skip SSL verification for self-signed certs
      // Note: In production, properly configure CA certs
    });
    
    if (!response.ok) {
      console.error("Failed to fetch k3s secrets:", response.statusText);
      return getMockSecrets();
    }
    
    const data = await response.json();
    const k3sSecrets: K3sSecret[] = data.items || [];
    
    // Filter and format secrets (exclude system secrets)
    const userSecrets = k3sSecrets.filter(secret => 
      !secret.metadata.name.startsWith("default-token-") &&
      !secret.metadata.name.startsWith("sh.helm.") &&
      secret.metadata.namespace !== "kube-system" &&
      secret.metadata.namespace !== "kube-public"
    );
    
    userSecrets.forEach(secret => {
      secrets.push({
        name: secret.metadata.name,
        namespace: secret.metadata.namespace,
        type: secret.type,
        createdAt: secret.metadata.creationTimestamp,
        keys: Object.keys(secret.data || {}),
        lastRotated: secret.metadata.annotations?.["secret-rotation/last-rotated"],
        expiresAt: secret.metadata.annotations?.["secret-rotation/expires"],
      });
    });
    
  } catch (error) {
    console.error("Error fetching k3s secrets:", error);
    return getMockSecrets();
  }
  
  return secrets;
}

function getMockSecrets(): Secret[] {
  return [
    {
      name: "control-panel-env",
      namespace: "gmac-io",
      type: "Opaque",
      createdAt: new Date().toISOString(),
      keys: ["GITHUB_ID", "GITHUB_SECRET", "NEXTAUTH_SECRET", "TURSO_AUTH_TOKEN"],
    },
    {
      name: "stripe-api-keys",
      namespace: "production",
      type: "Opaque",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      lastRotated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      name: "clerk-api-keys",
      namespace: "production",
      type: "Opaque",
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      keys: ["CLERK_SECRET_KEY", "CLERK_JWT_KEY"],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}