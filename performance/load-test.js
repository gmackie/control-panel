import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const requestCount = new Counter('requests');

// Test configuration
export const options = {
  stages: [
    // Ramp-up
    { duration: '2m', target: 10 }, // Ramp up to 10 users over 2 minutes
    { duration: '5m', target: 10 }, // Hold at 10 users for 5 minutes
    { duration: '2m', target: 20 }, // Ramp up to 20 users over 2 minutes
    { duration: '5m', target: 20 }, // Hold at 20 users for 5 minutes
    { duration: '2m', target: 50 }, // Ramp up to 50 users over 2 minutes
    { duration: '5m', target: 50 }, // Hold at 50 users for 5 minutes
    { duration: '2m', target: 100 }, // Ramp up to 100 users over 2 minutes
    { duration: '5m', target: 100 }, // Hold at 100 users for 5 minutes
    // Ramp-down
    { duration: '2m', target: 0 }, // Ramp down to 0 users over 2 minutes
  ],
  thresholds: {
    // Error rate should be less than 1%
    errors: ['rate<0.01'],
    // 95% of requests should complete within 500ms
    http_req_duration: ['p(95)<500'],
    // Average response time should be less than 200ms
    'http_req_duration{endpoint:api}': ['avg<200'],
    // Authentication endpoints should be faster
    'http_req_duration{endpoint:auth}': ['avg<100'],
  },
  // Maximum virtual users
  vus: 100,
  // Test timeout
  maxRedirects: 4,
};

// Base URL - can be overridden with K6_BASE_URL environment variable
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';

// Test data
const TEST_USERS = [
  { email: 'test1@gmac.io', token: 'mock-token-1' },
  { email: 'test2@gmac.io', token: 'mock-token-2' },
  { email: 'test3@gmac.io', token: 'mock-token-3' },
];

// Helper function to make authenticated requests
function makeAuthenticatedRequest(url, options = {}) {
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
    ...options.headers,
  };
  
  return http.request(options.method || 'GET', url, options.body, { headers, tags: options.tags });
}

// Main test function
export default function () {
  group('Health Check', () => {
    const response = http.get(`${BASE_URL}/api/health`, {
      tags: { endpoint: 'health' }
    });
    
    check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
      'health check has correct status': (r) => JSON.parse(r.body).status === 'healthy',
    });
    
    errorRate.add(response.status !== 200);
    responseTimeTrend.add(response.timings.duration);
    requestCount.add(1);
  });
  
  group('Authentication', () => {
    // Test session verification
    const sessionResponse = makeAuthenticatedRequest(`${BASE_URL}/api/auth/verify`, {
      tags: { endpoint: 'auth' }
    });
    
    check(sessionResponse, {
      'auth verify status is 200': (r) => r.status === 200,
      'auth verify response time < 200ms': (r) => r.timings.duration < 200,
      'auth verify returns valid session': (r) => JSON.parse(r.body).valid === true,
    });
    
    errorRate.add(sessionResponse.status !== 200);
    responseTimeTrend.add(sessionResponse.timings.duration);
    requestCount.add(1);
  });
  
  group('Monitoring APIs', () => {
    // Test metrics endpoint
    const metricsResponse = makeAuthenticatedRequest(`${BASE_URL}/api/monitoring/metrics`, {
      tags: { endpoint: 'api' }
    });
    
    check(metricsResponse, {
      'metrics status is 200': (r) => r.status === 200,
      'metrics response time < 500ms': (r) => r.timings.duration < 500,
      'metrics has system data': (r) => {
        const data = JSON.parse(r.body);
        return data.system && data.system.cpu;
      },
    });
    
    errorRate.add(metricsResponse.status !== 200);
    responseTimeTrend.add(metricsResponse.timings.duration);
    requestCount.add(1);
    
    // Test alerts endpoint
    const alertsResponse = makeAuthenticatedRequest(`${BASE_URL}/api/monitoring/alerts`, {
      tags: { endpoint: 'api' }
    });
    
    check(alertsResponse, {
      'alerts status is 200': (r) => r.status === 200,
      'alerts response time < 300ms': (r) => r.timings.duration < 300,
      'alerts has summary': (r) => {
        const data = JSON.parse(r.body);
        return data.summary && typeof data.summary.total === 'number';
      },
    });
    
    errorRate.add(alertsResponse.status !== 200);
    responseTimeTrend.add(alertsResponse.timings.duration);
    requestCount.add(1);
  });
  
  group('Cluster APIs', () => {
    // Test cluster health
    const clusterHealthResponse = makeAuthenticatedRequest(`${BASE_URL}/api/cluster/health`, {
      tags: { endpoint: 'api' }
    });
    
    check(clusterHealthResponse, {
      'cluster health status is 200': (r) => r.status === 200,
      'cluster health response time < 400ms': (r) => r.timings.duration < 400,
      'cluster health has status': (r) => {
        const data = JSON.parse(r.body);
        return data.status;
      },
    });
    
    errorRate.add(clusterHealthResponse.status !== 200);
    responseTimeTrend.add(clusterHealthResponse.timings.duration);
    requestCount.add(1);
    
    // Test nodes endpoint
    const nodesResponse = makeAuthenticatedRequest(`${BASE_URL}/api/cluster/nodes`, {
      tags: { endpoint: 'api' }
    });
    
    check(nodesResponse, {
      'nodes status is 200': (r) => r.status === 200,
      'nodes response time < 600ms': (r) => r.timings.duration < 600,
      'nodes has array': (r) => {
        const data = JSON.parse(r.body);
        return Array.isArray(data.nodes);
      },
    });
    
    errorRate.add(nodesResponse.status !== 200);
    responseTimeTrend.add(nodesResponse.timings.duration);
    requestCount.add(1);
  });
  
  group('Applications APIs', () => {
    // Test applications list
    const appsResponse = makeAuthenticatedRequest(`${BASE_URL}/api/applications`, {
      tags: { endpoint: 'api' }
    });
    
    check(appsResponse, {
      'applications status is 200': (r) => r.status === 200,
      'applications response time < 400ms': (r) => r.timings.duration < 400,
      'applications has array': (r) => {
        const data = JSON.parse(r.body);
        return Array.isArray(data.applications);
      },
    });
    
    errorRate.add(appsResponse.status !== 200);
    responseTimeTrend.add(appsResponse.timings.duration);
    requestCount.add(1);
  });
  
  group('Infrastructure APIs', () => {
    // Test infrastructure overview
    const infraResponse = makeAuthenticatedRequest(`${BASE_URL}/api/infrastructure/overview`, {
      tags: { endpoint: 'api' }
    });
    
    check(infraResponse, {
      'infrastructure status is 200': (r) => r.status === 200,
      'infrastructure response time < 500ms': (r) => r.timings.duration < 500,
      'infrastructure has cluster data': (r) => {
        const data = JSON.parse(r.body);
        return data.cluster;
      },
    });
    
    errorRate.add(infraResponse.status !== 200);
    responseTimeTrend.add(infraResponse.timings.duration);
    requestCount.add(1);
  });
  
  // Random sleep between 1-3 seconds to simulate user behavior
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting load test for GMAC.IO Control Panel');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Test duration: ~30 minutes`);
  
  // Verify the service is available
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    throw new Error(`Service not available at ${BASE_URL}. Status: ${response.status}`);
  }
  
  console.log('Service is available, starting load test...');
  return { baseUrl: BASE_URL };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Target URL was: ${data.baseUrl}`);
}

// Spike test configuration - uncomment to run spike test
/*
export const spikeTestOptions = {
  stages: [
    { duration: '1m', target: 10 },   // Baseline
    { duration: '30s', target: 200 }, // Spike to 200 users
    { duration: '1m', target: 10 },   // Return to baseline
  ],
  thresholds: {
    errors: ['rate<0.05'], // Allow higher error rate during spike
    http_req_duration: ['p(95)<2000'], // Allow higher response times
  },
};
*/

// Stress test configuration - uncomment to run stress test
/*
export const stressTestOptions = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 100 },  // Normal load
    { duration: '2m', target: 200 },  // Stress load
    { duration: '5m', target: 200 },  // Maintain stress
    { duration: '2m', target: 300 },  // Beyond normal capacity
    { duration: '5m', target: 300 },  // Maintain beyond capacity
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    errors: ['rate<0.1'], // Allow 10% error rate under stress
    http_req_duration: ['p(95)<5000'], // Allow 5s response time under stress
  },
};
*/

// Volume test configuration - uncomment to run volume test
/*
export const volumeTestOptions = {
  stages: [
    { duration: '5m', target: 100 },  // Ramp up
    { duration: '30m', target: 100 }, // Extended duration
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    errors: ['rate<0.02'],
    http_req_duration: ['p(95)<1000'],
  },
};
*/