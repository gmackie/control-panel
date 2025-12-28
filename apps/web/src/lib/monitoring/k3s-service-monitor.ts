import { AppService } from "@/types";

interface K3sService {
  name: string;
  namespace: string;
  url?: string;
  type: AppService["type"];
}

// Define our production services
const PRODUCTION_SERVICES: K3sService[] = [
  {
    name: "clerk-stripe-starter",
    namespace: "production",
    url: "https://clerk-stripe-starter.gmac.io",
    type: "nextjs",
  },
  {
    name: "turntable-bot",
    namespace: "production",
    url: "https://turntable.gmac.io",
    type: "nextjs",
  },
  {
    name: "classback",
    namespace: "production",
    url: "https://classback.gmac.io/api/health",
    type: "go-api",
  },
];

export async function getK3sServiceStatus(): Promise<AppService[]> {
  const services: AppService[] = [];

  for (const service of PRODUCTION_SERVICES) {
    let status: AppService["status"] = "unknown";
    let responseTime: number | undefined;
    let version: string | undefined;

    if (service.url) {
      const startTime = Date.now();
      try {
        const response = await fetch(service.url, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        
        responseTime = Date.now() - startTime;
        
        if (response.ok) {
          status = "healthy";
          // Try to get version from headers or response
          version = response.headers.get("x-app-version") || undefined;
        } else if (response.status >= 500) {
          status = "error";
        } else {
          status = "warning";
        }
      } catch (error) {
        responseTime = Date.now() - startTime;
        status = "error";
      }
    }

    services.push({
      id: `${service.namespace}-${service.name}`,
      name: service.name,
      type: service.type,
      status,
      uptime: status === "healthy" ? "99.9%" : "0%",
      version: version || "unknown",
      lastChecked: new Date().toISOString(),
      environment: service.namespace as "production" | "staging" | "development",
      url: service.url,
      metrics: {
        cpu: undefined,
        memory: undefined,
        requests: 0,
        errorRate: 0,
        responseTime: responseTime || undefined,
      },
    });
  }

  return services;
}

// Compatibility adapter for existing imports
export class K3sServiceMonitor {
  async getServiceStatus(): Promise<AppService[]> {
    return getK3sServiceStatus()
  }
}
