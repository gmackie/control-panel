import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  startedAt: Date;
  resolvedAt?: Date;
  impact: string;
  updates: IncidentUpdate[];
}

interface IncidentUpdate {
  id: string;
  timestamp: Date;
  status: Incident['status'];
  message: string;
  user: string;
}

const generateMockIncidents = (): Incident[] => {
  const now = new Date();
  const incidents: Incident[] = [
    {
      id: 'inc-001',
      title: 'Grafana Dashboard Loading Issues',
      status: 'monitoring',
      severity: 'medium',
      affectedServices: ['grafana'],
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      impact: 'Users experiencing slow loading times when accessing Grafana dashboards. Some complex queries are timing out.',
      updates: [
        {
          id: 'upd-001',
          timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
          status: 'monitoring',
          message: 'Implemented query optimization and increased timeout limits. Monitoring for improvement.',
          user: 'ops-team'
        },
        {
          id: 'upd-002',
          timestamp: new Date(now.getTime() - 90 * 60 * 1000), // 90 minutes ago
          status: 'identified',
          message: 'Root cause identified as inefficient database queries during high load periods.',
          user: 'ops-team'
        },
        {
          id: 'upd-003',
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
          status: 'investigating',
          message: 'Investigating reports of slow Grafana dashboard loading times.',
          user: 'ops-team'
        }
      ]
    },
    {
      id: 'inc-002',
      title: 'K3s Node Memory Pressure',
      status: 'investigating',
      severity: 'high',
      affectedServices: ['k3s-cluster'],
      startedAt: new Date(now.getTime() - 45 * 60 * 1000), // 45 minutes ago
      impact: 'One K3s node experiencing memory pressure, causing pod evictions and potential service disruptions.',
      updates: [
        {
          id: 'upd-004',
          timestamp: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
          status: 'investigating',
          message: 'Identified memory leak in one of the deployed applications. Working on emergency patch.',
          user: 'ops-team'
        },
        {
          id: 'upd-005',
          timestamp: new Date(now.getTime() - 45 * 60 * 1000), // 45 minutes ago
          status: 'investigating',
          message: 'High memory usage detected on worker-node-02. Investigating potential causes.',
          user: 'ops-team'
        }
      ]
    },
    {
      id: 'inc-003',
      title: 'Harbor Registry Authentication Timeout',
      status: 'resolved',
      severity: 'medium',
      affectedServices: ['harbor-registry'],
      startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24 hours ago
      resolvedAt: new Date(now.getTime() - 22 * 60 * 60 * 1000), // 22 hours ago
      impact: 'Docker image push/pull operations failing due to authentication timeouts.',
      updates: [
        {
          id: 'upd-006',
          timestamp: new Date(now.getTime() - 22 * 60 * 60 * 1000), // 22 hours ago
          status: 'resolved',
          message: 'Issue resolved after restarting Harbor authentication service and clearing session cache.',
          user: 'ops-team'
        },
        {
          id: 'upd-007',
          timestamp: new Date(now.getTime() - 23 * 60 * 60 * 1000), // 23 hours ago
          status: 'identified',
          message: 'Authentication service appears to have stale sessions causing timeout issues.',
          user: 'ops-team'
        },
        {
          id: 'upd-008',
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24 hours ago
          status: 'investigating',
          message: 'Reports of Harbor registry authentication failures. Investigating authentication service.',
          user: 'ops-team'
        }
      ]
    },
    {
      id: 'inc-004',
      title: 'Prometheus Disk Space Alert',
      status: 'resolved',
      severity: 'low',
      affectedServices: ['prometheus'],
      startedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      resolvedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      impact: 'Prometheus storage volume approaching 80% capacity.',
      updates: [
        {
          id: 'upd-009',
          timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
          status: 'resolved',
          message: 'Storage volume expanded and retention policies optimized to prevent future issues.',
          user: 'ops-team'
        },
        {
          id: 'upd-010',
          timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          status: 'investigating',
          message: 'Disk space alert triggered for Prometheus storage. Planning storage expansion.',
          user: 'ops-team'
        }
      ]
    }
  ];

  // Sort updates in reverse chronological order (newest first)
  incidents.forEach(incident => {
    incident.updates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  });

  return incidents;
};

export async function GET(request: NextRequest) {
  try {
    const incidents = generateMockIncidents();

    const activeIncidents = incidents.filter(i => i.status !== 'resolved');
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

    return NextResponse.json({
      success: true,
      incidents,
      summary: {
        total: incidents.length,
        active: activeIncidents.length,
        resolved: resolvedIncidents.length,
        critical: incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length,
        high: incidents.filter(i => i.severity === 'high' && i.status !== 'resolved').length,
        medium: incidents.filter(i => i.severity === 'medium' && i.status !== 'resolved').length,
        low: incidents.filter(i => i.severity === 'low' && i.status !== 'resolved').length
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    if (action === 'create') {
      const newIncident: Incident = {
        id: randomUUID(),
        title: data.title,
        status: data.status || 'investigating',
        severity: data.severity,
        affectedServices: data.affectedServices || [],
        startedAt: new Date(),
        impact: data.impact,
        updates: [
          {
            id: randomUUID(),
            timestamp: new Date(),
            status: data.status || 'investigating',
            message: `Incident created: ${data.title}`,
            user: 'ops-team'
          }
        ]
      };

      return NextResponse.json({
        success: true,
        incident: newIncident,
        message: 'Incident created successfully'
      });
    }

    if (action === 'update') {
      const { incidentId, status, message, user } = data;
      
      const update: IncidentUpdate = {
        id: randomUUID(),
        timestamp: new Date(),
        status,
        message,
        user: user || 'ops-team'
      };

      return NextResponse.json({
        success: true,
        update,
        message: 'Incident updated successfully'
      });
    }

    if (action === 'resolve') {
      const { incidentId, message, user } = data;

      const resolveUpdate: IncidentUpdate = {
        id: randomUUID(),
        timestamp: new Date(),
        status: 'resolved',
        message: message || 'Incident has been resolved.',
        user: user || 'ops-team'
      };

      return NextResponse.json({
        success: true,
        update: resolveUpdate,
        resolvedAt: new Date().toISOString(),
        message: 'Incident resolved successfully'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing incident request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process incident request' },
      { status: 500 }
    );
  }
}