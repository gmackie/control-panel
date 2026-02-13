'use client';

import { useEffect, useState } from 'react';
import type { PodHealthIssue, NodeHealthIssue } from '@/lib/monitoring/cluster-health-watcher';

interface HealthData {
  running: boolean;
  summary: { nodes: { total: number; ready: number }; pods: { total: number; running: number } } | null;
  issues: { nodes: NodeHealthIssue[]; pods: PodHealthIssue[]; total: number };
}

export function ClusterHealthBanner() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    // Initial fetch
    fetch('/api/cluster/health/issues')
      .then(r => r.json())
      .then(setHealth)
      .catch(console.error);

    // SSE subscription
    const es = new EventSource('/api/cluster/health/issues/stream');

    es.addEventListener('snapshot', (e) => {
      const snapshot = JSON.parse(e.data);
      if (snapshot) {
        setHealth(prev => prev ? {
          ...prev,
          summary: { nodes: snapshot.nodes, pods: snapshot.pods },
          issues: {
            nodes: snapshot.nodes.issues,
            pods: snapshot.pods.issues,
            total: snapshot.nodes.issues.length + snapshot.pods.issues.length,
          },
        } : prev);
      }
    });

    es.addEventListener('podIssue', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const pods = [...prev.issues.pods.filter(p => p.id !== issue.id), issue];
        return { ...prev, issues: { ...prev.issues, pods, total: prev.issues.nodes.length + pods.length } };
      });
    });

    es.addEventListener('nodeIssue', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const nodes = [...prev.issues.nodes.filter(n => n.id !== issue.id), issue];
        return { ...prev, issues: { ...prev.issues, nodes, total: nodes.length + prev.issues.pods.length } };
      });
    });

    es.addEventListener('podIssueResolved', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const pods = prev.issues.pods.filter(p => p.id !== issue.id);
        return { ...prev, issues: { ...prev.issues, pods, total: prev.issues.nodes.length + pods.length } };
      });
    });

    es.addEventListener('nodeIssueResolved', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const nodes = prev.issues.nodes.filter(n => n.id !== issue.id);
        return { ...prev, issues: { ...prev.issues, nodes, total: nodes.length + prev.issues.pods.length } };
      });
    });

    return () => es.close();
  }, []);

  if (!health || !health.running) return null;

  const hasCritical = health.issues.nodes.some(i => i.severity === 'critical') ||
                      health.issues.pods.some(i => i.severity === 'critical');
  const hasWarning = health.issues.total > 0;

  const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy';
  const colors = {
    healthy: 'bg-green-500/10 border-green-500/20 text-green-400',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    critical: 'bg-red-500/10 border-red-500/20 text-red-400',
  };

  return (
    <div className={`rounded-lg border p-3 mb-4 ${colors[status]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'healthy' ? 'bg-green-400' :
            status === 'warning' ? 'bg-yellow-400 animate-pulse' :
            'bg-red-400 animate-pulse'
          }`} />
          <span className="font-medium text-sm">
            {status === 'healthy'
              ? `Cluster healthy — ${health.summary?.nodes.ready}/${health.summary?.nodes.total} nodes, ${health.summary?.pods.running}/${health.summary?.pods.total} pods`
              : `${health.issues.total} issue${health.issues.total !== 1 ? 's' : ''} detected`}
          </span>
        </div>
        {health.issues.total > 0 && (
          <div className="text-xs opacity-75">
            {health.issues.nodes.length > 0 && `${health.issues.nodes.length} node`}
            {health.issues.nodes.length > 0 && health.issues.pods.length > 0 && ' · '}
            {health.issues.pods.length > 0 && `${health.issues.pods.length} pod`}
          </div>
        )}
      </div>
      {health.issues.total > 0 && (
        <div className="mt-2 space-y-1">
          {[...health.issues.nodes, ...health.issues.pods]
            .sort((a, b) => {
              if (a.severity === 'critical' && b.severity !== 'critical') return -1;
              if (a.severity !== 'critical' && b.severity === 'critical') return 1;
              return 0;
            })
            .slice(0, 5)
            .map(issue => (
              <div key={issue.id} className="text-xs opacity-90 flex items-center gap-1.5">
                <span className={issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}>
                  {issue.severity === 'critical' ? '●' : '○'}
                </span>
                {issue.message}
              </div>
            ))}
          {health.issues.total > 5 && (
            <div className="text-xs opacity-60">and {health.issues.total - 5} more...</div>
          )}
        </div>
      )}
    </div>
  );
}
