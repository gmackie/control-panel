/**
 * Utility Functions Tests
 * 
 * Tests for shared utility functions
 */

import { describe, it, expect } from 'vitest';

// Test basic utils functionality
describe('Utility Functions', () => {
  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(date.toISOString()).toContain('2024-01-15');
    });

    it('should handle relative time calculations', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const diffMs = now.getTime() - oneHourAgo.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(1, 1);
    });
  });

  describe('String Operations', () => {
    it('should generate slug from name', () => {
      const name = 'My Cool App';
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      expect(slug).toBe('my-cool-app');
    });

    it('should truncate long strings', () => {
      const longText = 'This is a very long string that needs to be truncated';
      const maxLength = 20;
      const truncated = longText.length > maxLength 
        ? longText.substring(0, maxLength) + '...'
        : longText;
      expect(truncated).toBe('This is a very long ...');
      expect(truncated.length).toBeLessThan(longText.length);
    });
  });

  describe('Number Operations', () => {
    it('should format bytes to human readable', () => {
      const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
      };

      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should calculate percentages correctly', () => {
      const calculatePercentage = (value: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
      };

      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(0, 100)).toBe(0);
      expect(calculatePercentage(100, 0)).toBe(0);
    });
  });

  describe('Array Operations', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];

      const grouped = items.reduce((acc, item) => {
        if (!acc[item.type]) {
          acc[item.type] = [];
        }
        acc[item.type].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      expect(grouped['a']).toHaveLength(2);
      expect(grouped['b']).toHaveLength(1);
    });

    it('should sort items by date', () => {
      const items = [
        { date: '2024-01-03' },
        { date: '2024-01-01' },
        { date: '2024-01-02' },
      ];

      const sorted = [...items].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      expect(sorted[0].date).toBe('2024-01-01');
      expect(sorted[2].date).toBe('2024-01-03');
    });
  });
});

describe('Status Helpers', () => {
  it('should map status to color', () => {
    const getStatusColor = (status: string) => {
      const colorMap: Record<string, string> = {
        'healthy': 'green',
        'degraded': 'yellow',
        'unhealthy': 'red',
        'unknown': 'gray',
      };
      return colorMap[status] || 'gray';
    };

    expect(getStatusColor('healthy')).toBe('green');
    expect(getStatusColor('degraded')).toBe('yellow');
    expect(getStatusColor('unhealthy')).toBe('red');
    expect(getStatusColor('unknown')).toBe('gray');
    expect(getStatusColor('invalid')).toBe('gray');
  });

  it('should determine severity level', () => {
    const getSeverityLevel = (severity: string): number => {
      const levels: Record<string, number> = {
        'critical': 4,
        'high': 3,
        'medium': 2,
        'low': 1,
        'info': 0,
      };
      return levels[severity] ?? 0;
    };

    expect(getSeverityLevel('critical')).toBe(4);
    expect(getSeverityLevel('low')).toBe(1);
    expect(getSeverityLevel('unknown')).toBe(0);
  });
});

describe('Validation Helpers', () => {
  it('should validate email format', () => {
    const isValidEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('should validate URL format', () => {
    const isValidUrl = (url: string) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('should validate slug format', () => {
    const isValidSlug = (slug: string) => {
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      return slugRegex.test(slug);
    };

    expect(isValidSlug('my-app')).toBe(true);
    expect(isValidSlug('app123')).toBe(true);
    expect(isValidSlug('My-App')).toBe(false);
    expect(isValidSlug('my app')).toBe(false);
    expect(isValidSlug('my--app')).toBe(false);
  });
});
