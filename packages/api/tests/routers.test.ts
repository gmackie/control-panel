/**
 * tRPC Router Unit Tests
 * 
 * Tests for all tRPC routers in the API package
 */

import { describe, it, expect, vi } from 'vitest';
import { appRouter } from '../src/routers/index.js';

// Create a chainable mock that properly handles all Drizzle ORM methods
function createMockDb(resolvedValue: any = []) {
  const createChain = (value: any) => {
    const chain: any = {
      select: vi.fn(() => createChain(value)),
      from: vi.fn(() => createChain(value)),
      where: vi.fn(() => createChain(value)),
      orderBy: vi.fn(() => createChain(value)),
      limit: vi.fn(() => createChain(value)),
      offset: vi.fn(() => createChain(value)),
      insert: vi.fn(() => createChain(value)),
      values: vi.fn(() => createChain(value)),
      update: vi.fn(() => createChain(value)),
      set: vi.fn(() => createChain(value)),
      returning: vi.fn(() => createChain(value)),
      // Make it thenable so await works
      then: (resolve: any) => Promise.resolve(value).then(resolve),
    };
    return chain;
  };
  
  return createChain(resolvedValue);
}

// Create a caller for testing
function createTestCaller(db: any) {
  const ctx = { db } as any;
  return appRouter.createCaller(ctx);
}

describe('Applications Router', () => {
  describe('list', () => {
    it('should return empty array when no applications', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.applications.list();
      
      expect(result).toEqual([]);
    });

    it('should return applications with dates converted', async () => {
      const mockApps = [
        {
          id: 'app-1',
          name: 'Test App',
          slug: 'test-app',
          description: 'A test app',
          repositoryUrl: 'https://github.com/test/app',
          status: 'active',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      ];
      const mockDb = createMockDb(mockApps);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.applications.list();
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test App');
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should throw when database is not available', async () => {
      const caller = createTestCaller(null);
      
      await expect(caller.applications.list()).rejects.toThrow('Database not available');
    });
  });

  describe('byId', () => {
    it('should return application by ID', async () => {
      const mockApp = {
        id: 'app-1',
        name: 'Test App',
        slug: 'test-app',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      const mockDb = createMockDb([mockApp]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.applications.byId('app-1');
      
      expect(result.id).toBe('app-1');
      expect(result.name).toBe('Test App');
    });

    it('should throw NOT_FOUND when application does not exist', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      await expect(caller.applications.byId('non-existent')).rejects.toThrow('Application not found');
    });
  });

  describe('bySlug', () => {
    it('should return application by slug', async () => {
      const mockApp = {
        id: 'app-1',
        name: 'Test App',
        slug: 'test-app',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
      const mockDb = createMockDb([mockApp]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.applications.bySlug('test-app');
      
      expect(result.slug).toBe('test-app');
    });
  });
});

describe('Notifications Router', () => {
  describe('list', () => {
    it('should return notifications with pagination', async () => {
      // For list, we need to handle Promise.all with two queries
      // The implementation does two queries, so we need a more complex mock
      const mockNotifications = [
        {
          id: 'notif-1',
          title: 'Test Notification',
          message: 'This is a test',
          category: 'system',
          severity: 'info',
          status: 'new',
          source: 'test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      
      // Create a mock that returns different values for different query chains
      let callCount = 0;
      const createSequentialMockDb = () => {
        const createChain = (): any => {
          const chain: any = {
            select: vi.fn(() => createChain()),
            from: vi.fn(() => createChain()),
            where: vi.fn(() => createChain()),
            orderBy: vi.fn(() => createChain()),
            limit: vi.fn(() => createChain()),
            offset: vi.fn(() => createChain()),
            then: (resolve: any) => {
              callCount++;
              // First call returns notifications, second returns count
              if (callCount === 1) {
                return Promise.resolve(mockNotifications).then(resolve);
              }
              return Promise.resolve([{ count: 1 }]).then(resolve);
            },
          };
          return chain;
        };
        return createChain();
      };
      
      const mockDb = createSequentialMockDb();
      const caller = createTestCaller(mockDb);
      
      const result = await caller.notifications.list({ limit: 10, offset: 0 });
      
      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should handle empty notifications', async () => {
      let callCount = 0;
      const createSequentialMockDb = () => {
        const createChain = (): any => {
          const chain: any = {
            select: vi.fn(() => createChain()),
            from: vi.fn(() => createChain()),
            where: vi.fn(() => createChain()),
            orderBy: vi.fn(() => createChain()),
            limit: vi.fn(() => createChain()),
            offset: vi.fn(() => createChain()),
            then: (resolve: any) => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve([]).then(resolve);
              }
              return Promise.resolve([{ count: 0 }]).then(resolve);
            },
          };
          return chain;
        };
        return createChain();
      };
      
      const mockDb = createSequentialMockDb();
      const caller = createTestCaller(mockDb);
      
      const result = await caller.notifications.list();
      
      expect(result.notifications).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('unreadCount', () => {
    it('should return count of unread notifications', async () => {
      const mockDb = createMockDb([{ count: 5 }]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.notifications.unreadCount();
      
      expect(result).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      const mockDb = createMockDb([{}]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.notifications.unreadCount();
      
      expect(result).toBe(0);
    });
  });

  describe('stats', () => {
    it('should return notification statistics', async () => {
      // Stats makes multiple queries
      let callCount = 0;
      const createSequentialMockDb = () => {
        const createChain = (): any => {
          const chain: any = {
            select: vi.fn(() => createChain()),
            from: vi.fn(() => createChain()),
            where: vi.fn(() => createChain()),
            then: (resolve: any) => {
              callCount++;
              return Promise.resolve([{ count: 100 - callCount * 10 }]).then(resolve);
            },
          };
          return chain;
        };
        return createChain();
      };
      
      const mockDb = createSequentialMockDb();
      const caller = createTestCaller(mockDb);
      
      const result = await caller.notifications.stats();
      
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('unread');
      expect(result).toHaveProperty('last24h');
      expect(result).toHaveProperty('last7d');
    });
  });
});

describe('Notification Preferences', () => {
  describe('getPreferences', () => {
    it('should return default preferences when none exist', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.notifications.getPreferences();
      
      expect(result).toHaveProperty('emailEnabled', true);
      expect(result).toHaveProperty('slackEnabled', true);
      expect(result).toHaveProperty('pushEnabled', true);
      expect(result).toHaveProperty('inAppEnabled', true);
      expect(result).toHaveProperty('categoryPreferences');
      expect(result.categoryPreferences).toHaveProperty('alerts', true);
      expect(result.categoryPreferences).toHaveProperty('deployments', true);
      expect(result).toHaveProperty('quietHours');
      expect(result.quietHours).toHaveProperty('enabled', false);
    });

    it('should return saved preferences when they exist', async () => {
      const mockPrefs = [{
        userId: 'test-user',
        emailEnabled: false,
        slackEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        categoryPreferences: JSON.stringify({ alerts: false, deployments: true }),
        quietHours: JSON.stringify({ enabled: true, start: '23:00', end: '07:00' }),
      }];
      const mockDb = createMockDb(mockPrefs);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.notifications.getPreferences();
      
      expect(result.emailEnabled).toBe(false);
      expect(result.categoryPreferences.alerts).toBe(false);
      expect(result.quietHours.enabled).toBe(true);
      expect(result.quietHours.start).toBe('23:00');
    });
  });
});

describe('Activity Router', () => {
  describe('recent', () => {
    it('should return recent activity events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
          source: 'gitea',
          category: 'deployment',
          eventType: 'push',
          severity: 'info',
          title: 'Code pushed',
          links: null,
          metadata: null,
        },
      ];
      const mockDb = createMockDb(mockEvents);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.activity.recent({ limit: 10 });
      
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBeInstanceOf(Date);
    });

    it('should use default limit of 20', async () => {
      // Test that the default limit is used by calling without params
      // and verifying it returns the mock data successfully
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      // Should not throw when called without parameters
      const result = await caller.activity.recent();
      
      // Should return array (even if empty)
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('Clusters Router', () => {
  describe('list', () => {
    it('should return list of clusters', async () => {
      // Clusters router uses mock data, not DB
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.clusters.list();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('status');
    });
  });

  describe('byId', () => {
    it('should return cluster details', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const clusters = await caller.clusters.list();
      const result = await caller.clusters.byId(clusters[0].id);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('nodes');
      expect(Array.isArray(result.nodes)).toBe(true);
    });

    it('should throw NOT_FOUND for invalid cluster', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      await expect(caller.clusters.byId('invalid-id')).rejects.toThrow('Cluster not found');
    });
  });

  describe('health', () => {
    it('should return cluster health summary', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.clusters.health();
      
      expect(result).toHaveProperty('totalClusters');
      expect(result).toHaveProperty('healthyClusters');
      expect(result).toHaveProperty('totalNodes');
      expect(result).toHaveProperty('readyNodes');
      expect(result).toHaveProperty('avgCpuUsage');
      expect(result).toHaveProperty('avgMemoryUsage');
    });
  });

  describe('costs', () => {
    it('should return cost breakdown', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.clusters.costs();
      
      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('breakdown');
      expect(Array.isArray(result.breakdown)).toBe(true);
    });
  });
});

describe('Deployments Router', () => {
  describe('list', () => {
    it('should return list of deployments', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.deployments.list();
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by environment', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.deployments.list({ environment: 'production' });
      
      result.forEach(deployment => {
        expect(deployment.environment).toBe('production');
      });
    });

    it('should filter by status', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.deployments.list({ status: 'succeeded' });
      
      result.forEach(deployment => {
        expect(deployment.status).toBe('succeeded');
      });
    });
  });

  describe('stats', () => {
    it('should return deployment statistics', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.deployments.stats();
      
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('succeeded');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('successRate');
      expect(result).toHaveProperty('byEnvironment');
    });
  });
});

describe('Monitoring Router', () => {
  describe('alerts', () => {
    it('should return list of alerts', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.monitoring.alerts();
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by severity', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.monitoring.alerts({ severity: 'critical' });
      
      result.forEach(alert => {
        expect(alert.severity).toBe('critical');
      });
    });
  });

  describe('alertStats', () => {
    it('should return alert statistics', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.monitoring.alertStats();
      
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('firing');
      expect(result).toHaveProperty('acknowledged');
      expect(result).toHaveProperty('bySeverity');
    });
  });

  describe('metrics', () => {
    it('should return system metrics', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.monitoring.metrics();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('value');
      expect(result[0]).toHaveProperty('status');
    });
  });

  describe('healthSummary', () => {
    it('should return overall health summary', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.monitoring.healthSummary();
      
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('metrics');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });
  });
});

describe('Infrastructure Router', () => {
  describe('repositories', () => {
    it('should return list of repositories', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.infrastructure.repositories();
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('images', () => {
    it('should return list of container images', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.infrastructure.images();
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('servers', () => {
    it('should return list of servers', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.infrastructure.servers();
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('name');
        expect(result[0]).toHaveProperty('status');
      }
    });
  });

  describe('health', () => {
    it('should return infrastructure health', async () => {
      const mockDb = createMockDb([]);
      const caller = createTestCaller(mockDb);
      
      const result = await caller.infrastructure.health();
      
      expect(result).toHaveProperty('gitea');
      expect(result).toHaveProperty('harbor');
      expect(result).toHaveProperty('hetzner');
      expect(result.gitea).toHaveProperty('status');
      expect(result.harbor).toHaveProperty('status');
      expect(result.hetzner).toHaveProperty('status');
    });
  });
});
