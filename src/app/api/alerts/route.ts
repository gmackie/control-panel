import { NextRequest, NextResponse } from 'next/server'
import { Alert } from '@/types'

// Mock alerts - replace with actual Alertmanager API
export async function GET(request: NextRequest) {
  try {
    // In production, fetch from Alertmanager API
    // const response = await fetch('https://alerts.gmac.io/api/v2/alerts', {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.OAUTH_TOKEN}`,
    //   },
    // })
    // const data = await response.json()
    
    // Mock data for now
    const mockAlerts: Alert[] = [
      {
        id: '1',
        name: 'HighMemoryUsage',
        severity: 'warning',
        status: 'firing',
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        summary: 'Memory usage above 80% on ci.gmac.io',
        description: 'Memory usage has been above 80% for more than 5 minutes',
        labels: { instance: 'ci.gmac.io', job: 'node' },
      },
      {
        id: '2',
        name: 'ServiceDown',
        severity: 'critical',
        status: 'resolved',
        startsAt: new Date(Date.now() - 7200000).toISOString(),
        endsAt: new Date(Date.now() - 3600000).toISOString(),
        summary: 'Gitea service was unavailable',
        description: 'Gitea API returned 5xx errors',
        labels: { service: 'gitea' },
      },
    ]
    
    return NextResponse.json(mockAlerts)
  } catch (error) {
    console.error('Failed to fetch alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}