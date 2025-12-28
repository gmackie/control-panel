import { NextRequest } from "next/server";
import { PrometheusClient } from "@/lib/prometheus/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prometheus = new PrometheusClient();

// Track if Prometheus is available
let prometheusAvailable = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

async function checkPrometheusHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return prometheusAvailable;
  }
  
  lastHealthCheck = now;
  try {
    prometheusAvailable = await prometheus.healthCheck();
  } catch {
    prometheusAvailable = false;
  }
  return prometheusAvailable;
}

// Real-time metrics stream using Server-Sent Events
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Check Prometheus health on connect
      const healthy = await checkPrometheusHealth();
      
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ 
          type: "connected", 
          timestamp: new Date().toISOString(),
          source: healthy ? "prometheus" : "mock"
        })}\n\n`)
      );
      
      // Set up interval to send metrics every 5 seconds
      const interval = setInterval(async () => {
        try {
          const metrics = await getRealtimeMetrics();
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "metrics", 
              data: metrics, 
              timestamp: new Date().toISOString() 
            })}\n\n`)
          );
        } catch (error) {
          console.error("Error fetching metrics:", error);
          // Send error event but keep connection alive
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "error", 
              message: "Failed to fetch metrics",
              timestamp: new Date().toISOString() 
            })}\n\n`)
          );
        }
      }, 5000);
      
      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

interface RealtimeMetrics {
  // Cluster overview
  nodeCount: number;
  podCount: number;
  cpuUsage: number;
  memoryUsage: number;
  
  // Request metrics
  requestsPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  
  // Network
  throughput: {
    in: string;
    out: string;
  };
  
  // Additional
  activeConnections: number;
  containerRestarts: number;
  
  // Metadata
  source: "prometheus" | "mock";
}

async function getRealtimeMetrics(): Promise<RealtimeMetrics> {
  // Check if Prometheus is available
  const healthy = await checkPrometheusHealth();
  
  if (healthy) {
    return getPrometheusMetrics();
  }
  
  return getMockMetrics();
}

async function getPrometheusMetrics(): Promise<RealtimeMetrics> {
  try {
    // Execute all queries in parallel for efficiency
    const [
      clusterMetrics,
      requestRate,
      responseTime,
      errorRate,
      networkIn,
      networkOut,
      containerRestarts,
    ] = await Promise.all([
      // Cluster metrics (node count, pod count, CPU, memory)
      prometheus.getClusterMetrics(),
      
      // Total request rate across all ingresses
      prometheus.instantQuery(
        'sum(rate(nginx_ingress_controller_requests[5m])) or sum(rate(http_requests_total[5m])) or vector(0)'
      ),
      
      // Average response time in ms
      prometheus.instantQuery(
        'histogram_quantile(0.5, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])) by (le)) * 1000 or histogram_quantile(0.5, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) * 1000 or vector(0)'
      ),
      
      // Error rate percentage
      prometheus.instantQuery(
        '(sum(rate(nginx_ingress_controller_requests{status=~"5.."}[5m])) / sum(rate(nginx_ingress_controller_requests[5m]))) * 100 or (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100 or vector(0)'
      ),
      
      // Network throughput in (MB/s)
      prometheus.instantQuery(
        'sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|flannel.*|cali.*|cbr.*"}[5m])) / 1024 / 1024'
      ),
      
      // Network throughput out (MB/s)
      prometheus.instantQuery(
        'sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|flannel.*|cali.*|cbr.*"}[5m])) / 1024 / 1024'
      ),
      
      // Container restarts in last hour
      prometheus.instantQuery(
        'sum(increase(kube_pod_container_status_restarts_total[1h])) or vector(0)'
      ),
    ]);

    return {
      nodeCount: clusterMetrics.nodeCount,
      podCount: clusterMetrics.podCount,
      cpuUsage: Math.round(clusterMetrics.cpuUsagePercent),
      memoryUsage: Math.round(clusterMetrics.memoryUsagePercent),
      
      requestsPerSecond: requestRate.length > 0 
        ? Math.round(parseFloat(requestRate[0].value[1]) * 100) / 100 
        : 0,
      avgResponseTime: responseTime.length > 0 
        ? Math.round(parseFloat(responseTime[0].value[1])) 
        : 0,
      errorRate: errorRate.length > 0 
        ? Math.round(parseFloat(errorRate[0].value[1]) * 100) / 100 
        : 0,
      
      throughput: {
        in: networkIn.length > 0 
          ? parseFloat(networkIn[0].value[1]).toFixed(2) 
          : "0.00",
        out: networkOut.length > 0 
          ? parseFloat(networkOut[0].value[1]).toFixed(2) 
          : "0.00",
      },
      
      activeConnections: clusterMetrics.podCount * 10, // Approximation
      containerRestarts: containerRestarts.length > 0 
        ? Math.round(parseFloat(containerRestarts[0].value[1])) 
        : 0,
      
      source: "prometheus",
    };
  } catch (error) {
    console.error("Error fetching Prometheus metrics:", error);
    // Fall back to mock on error
    prometheusAvailable = false;
    return getMockMetrics();
  }
}

function getMockMetrics(): RealtimeMetrics {
  return {
    nodeCount: 3,
    podCount: 45 + Math.floor(Math.random() * 10),
    cpuUsage: 30 + Math.floor(Math.random() * 40),
    memoryUsage: 45 + Math.floor(Math.random() * 30),
    
    requestsPerSecond: 150 + Math.floor(Math.random() * 50),
    avgResponseTime: 45 + Math.floor(Math.random() * 20),
    errorRate: Number((0.1 + Math.random() * 0.5).toFixed(2)),
    
    throughput: {
      in: (2.5 + Math.random() * 1.5).toFixed(2),
      out: (3.2 + Math.random() * 2).toFixed(2),
    },
    
    activeConnections: 1200 + Math.floor(Math.random() * 200),
    containerRestarts: Math.floor(Math.random() * 5),
    
    source: "mock",
  };
}
