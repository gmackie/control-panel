import axios from "axios";
import {
  AppService,
  Deployment,
  Metric,
  Alert,
  Repository,
  Customer,
  TursoDatabase,
  StripeMetrics,
  AppMetrics,
} from "@/types";

// Create axios instances for each service
const giteaApi = axios.create({
  baseURL: "/api/gitea",
  headers: {
    Authorization: `token ${process.env.NEXT_PUBLIC_GITEA_TOKEN}`,
  },
});

const prometheusApi = axios.create({
  baseURL: "/api/prometheus",
});

const k8sApi = axios.create({
  baseURL: "/api/k8s",
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_K8S_TOKEN}`,
  },
});

// System health check
export async function fetchSystemHealth() {
  const services = ["gitea", "prometheus", "grafana", "alertmanager"];
  const health = await Promise.all(
    services.map(async (service) => {
      try {
        const response = await fetch(`/api/health/${service}`);
        return { service, status: response.ok ? "healthy" : "error" };
      } catch {
        return { service, status: "error" };
      }
    })
  );
  return health;
}

// Fetch business metrics
export async function fetchBusinessMetrics() {
  try {
    const [stripe, usage] = await Promise.all([
      fetchStripeMetrics(),
      fetchUsageMetrics(),
    ]);
    return { stripe, usage };
  } catch (error) {
    console.error("Failed to fetch business metrics:", error);
    return null;
  }
}

// Fetch recent deployments
export async function fetchRecentDeployments(): Promise<Deployment[]> {
  try {
    const response = await fetch("/api/deployments/recent");
    return response.json();
  } catch (error) {
    return [];
  }
}

// Stripe metrics
export async function fetchStripeMetrics(): Promise<StripeMetrics> {
  try {
    const response = await fetch("/api/stripe/metrics");
    return response.json();
  } catch (error) {
    console.error("Failed to fetch Stripe metrics:", error);
    return {
      mrr: 0,
      arr: 0,
      newCustomers: 0,
      churnedCustomers: 0,
      revenue: {
        today: 0,
        month: 0,
        year: 0,
      },
      topPlans: [],
    };
  }
}

// Usage analytics
export async function fetchUsageMetrics(): Promise<AppMetrics> {
  try {
    const response = await fetch("/api/usage/metrics");
    return response.json();
  } catch (error) {
    console.error("Failed to fetch usage metrics:", error);
    return {
      appId: "",
      period: "day",
      requests: 0,
      uniqueUsers: 0,
      avgResponseTime: 0,
      errorRate: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      topEndpoints: [],
    };
  }
}

// Fetch top customers
export async function fetchTopCustomers(): Promise<Customer[]> {
  try {
    const response = await fetch("/api/customers/top");
    return response.json();
  } catch (error) {
    console.error("Failed to fetch top customers:", error);
    return [];
  }
}

// Fetch Turso databases
export async function fetchTursoDatabases(): Promise<TursoDatabase[]> {
  try {
    const response = await fetch("/api/turso/databases");
    return response.json();
  } catch (error) {
    console.error("Failed to fetch Turso databases:", error);
    return [];
  }
}

// Fetch alerts
export async function fetchAlerts(): Promise<Alert[]> {
  try {
    const response = await fetch("/api/alerts");
    return response.json();
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return [];
  }
}

// Fetch services
export async function fetchServices(): Promise<AppService[]> {
  try {
    const response = await fetch("/api/services");
    return response.json();
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

// Fetch apps
export async function fetchApps(): Promise<AppService[]> {
  try {
    const response = await fetch("/api/apps");
    return response.json();
  } catch (error) {
    console.error("Failed to fetch apps:", error);
    return [];
  }
}

// Create service
export async function createService(data: any): Promise<AppService> {
  try {
    const response = await fetch("/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return response.json();
  } catch (error) {
    console.error("Failed to create service:", error);
    throw error;
  }
}

// Fetch service by ID
export async function fetchService(id: string): Promise<AppService | null> {
  try {
    const response = await fetch(`/api/services/${id}`);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("Failed to fetch service:", error);
    return null;
  }
}

// Fetch service integrations
export async function fetchServiceIntegrations(
  serviceId: string
): Promise<any[]> {
  try {
    const response = await fetch(`/api/services/${serviceId}/integrations`);
    return response.json();
  } catch (error) {
    console.error("Failed to fetch service integrations:", error);
    return [];
  }
}

// Fetch service databases
export async function fetchServiceDatabases(serviceId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/services/${serviceId}/databases`);
    return response.json();
  } catch (error) {
    console.error("Failed to fetch service databases:", error);
    return [];
  }
}

// Fetch service monitoring
export async function fetchServiceMonitoring(serviceId: string): Promise<any> {
  try {
    const response = await fetch(`/api/services/${serviceId}/monitoring`);
    return response.json();
  } catch (error) {
    console.error("Failed to fetch service monitoring:", error);
    return null;
  }
}
