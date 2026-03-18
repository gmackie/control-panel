import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotificationService } from '@/lib/notifications/notification-service'
import { getDbAsync } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(),
}))

function createInsertChain<T>(returnedRecord: T, captured: { value?: Record<string, unknown> }) {
  return {
    values(value: Record<string, unknown>) {
      captured.value = value
      return {
        returning() {
          return Promise.resolve([returnedRecord])
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(resolve(undefined))
        },
      }
    },
  }
}

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets the database assign notification UUIDs', async () => {
    const captured: { value?: Record<string, unknown> } = {}
    const db = {
      insert: vi.fn(() =>
        createInsertChain(
          {
            id: '2d02edbc-6f72-4dd5-8e8a-535fb0d4e7cb',
            createdAt: new Date('2026-03-17T21:00:00.000Z'),
            updatedAt: new Date('2026-03-17T21:00:00.000Z'),
            source: 'release-control-room',
            sourceEventId: null,
            activityEventId: null,
            category: 'deployment',
            severity: 'info',
            title: 'Candidate ready',
            message: 'control-panel staging candidate is ready',
            appId: null,
            appName: 'control-panel',
            environment: 'staging',
            actions: null,
            links: null,
            status: 'new',
            acknowledgedBy: null,
            acknowledgedAt: null,
            resolvedBy: null,
            resolvedAt: null,
            snoozedUntil: null,
            groupKey: 'release-control-room:candidate_ready:control-panel:staging',
            groupCount: 1,
            deliveredVia: '[]',
            userId: null,
            metadata: null,
          },
          captured,
        ),
      ),
    }

    vi.mocked(getDbAsync).mockResolvedValue(db as never)

    const service = new NotificationService()
    const notification = await service.create({
      source: 'release-control-room',
      category: 'deployment',
      severity: 'info',
      title: 'Candidate ready',
      message: 'control-panel staging candidate is ready',
      appName: 'control-panel',
      environment: 'staging',
      groupKey: 'release-control-room:candidate_ready:control-panel:staging',
    })

    expect(captured.value?.id).toBeUndefined()
    expect(notification.id).toBe('2d02edbc-6f72-4dd5-8e8a-535fb0d4e7cb')
  })

  it('lets the database assign notification preference UUIDs', async () => {
    const captured: { value?: Record<string, unknown> } = {}
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
      insert: vi.fn(() =>
        createInsertChain(
          {
            id: '80f813bf-599d-4b4f-89c4-63accf6c3eca',
            userId: 'user-1',
            emailEnabled: true,
            slackEnabled: true,
            pushEnabled: true,
            inAppEnabled: true,
            categoryPreferences: null,
            quietHours: null,
            emailDigest: null,
            createdAt: new Date('2026-03-17T21:05:00.000Z'),
            updatedAt: new Date('2026-03-17T21:05:00.000Z'),
          },
          captured,
        ),
      ),
    }

    vi.mocked(getDbAsync).mockResolvedValue(db as never)

    const service = new NotificationService()
    const preferences = await service.getOrCreatePreferences('user-1')

    expect(captured.value?.id).toBeUndefined()
    expect(preferences.id).toBe('80f813bf-599d-4b4f-89c4-63accf6c3eca')
  })
})
