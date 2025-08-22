import { AppService } from "@/types";

interface ServiceCheck {
  url: string;
  expectedStatus?: number;
  timeout?: number;
}

export async function checkServiceHealth(service: ServiceCheck): Promise<{
  status: AppService["status"];
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), service.timeout || 5000);

  try {
    const response = await fetch(service.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "GMAC-Control-Panel/1.0",
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.status === (service.expectedStatus || 200)) {
      return {
        status: "healthy",
        responseTime,
      };
    } else if (response.status >= 500) {
      return {
        status: "error",
        responseTime,
        error: `Server error: ${response.status}`,
      };
    } else {
      return {
        status: "warning",
        responseTime,
        error: `Unexpected status: ${response.status}`,
      };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function checkMultipleServices(
  services: Array<{ id: string; url: string; expectedStatus?: number }>
): Promise<
  Array<{
    id: string;
    status: AppService["status"];
    responseTime?: number;
    error?: string;
  }>
> {
  const checks = services.map(async (service) => {
    const result = await checkServiceHealth({
      url: service.url,
      expectedStatus: service.expectedStatus,
    });
    return {
      id: service.id,
      ...result,
    };
  });

  return Promise.all(checks);
}