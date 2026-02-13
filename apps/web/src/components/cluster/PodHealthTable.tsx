'use client';

import { useEffect, useState } from 'react';
import type { PodHealthIssue } from '@/lib/monitoring/cluster-health-watcher';

export function PodHealthTable() {
  const [issues, setIssues] = useState<PodHealthIssue[]>([]);
  const [sortBy, setSortBy] = useState<'severity' | 'restarts' | 'namespace'>('severity');

  useEffect(() => {
    fetch('/api/cluster/health/issues')
      .then(r => r.json())
      .then(data => setIssues(data.issues?.pods || []))
      .catch(console.error);

    const interval = setInterval(() => {
      fetch('/api/cluster/health/issues')
        .then(r => r.json())
        .then(data => setIssues(data.issues?.pods || []))
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const sorted = [...issues].sort((a, b) => {
    if (sortBy === 'severity') return a.severity === 'critical' ? -1 : 1;
    if (sortBy === 'restarts') return (b.restartCount || 0) - (a.restartCount || 0);
    return a.namespace.localeCompare(b.namespace);
  });

  if (sorted.length === 0) return null;

  const typeLabels: Record<string, string> = {
    'crash-loop': 'CrashLoopBackOff',
    'excessive-restarts': 'High Restarts',
    'stuck-unknown': 'Unknown Status',
    'stuck-pending': 'Stuck Pending',
    'error': 'Error',
  };

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium">Pod Health Issues ({sorted.length})</h3>
        <div className="flex gap-1">
          {(['severity', 'restarts', 'namespace'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2 py-0.5 rounded ${sortBy === s ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500">
            <th className="text-left p-2">Namespace / Pod</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Node</th>
            <th className="text-right p-2">Restarts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(issue => (
            <tr key={issue.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="p-2">
                <div className="flex items-center gap-1.5">
                  <span className={issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}>●</span>
                  <div>
                    <div className="text-zinc-300">{issue.namespace}</div>
                    <div className="text-zinc-500 truncate max-w-[200px]">{issue.podName}</div>
                  </div>
                </div>
              </td>
              <td className="p-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  issue.type === 'crash-loop' ? 'bg-red-500/20 text-red-400' :
                  issue.type === 'excessive-restarts' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {typeLabels[issue.type] || issue.type}
                </span>
              </td>
              <td className="p-2 text-zinc-500">{issue.nodeName}</td>
              <td className="p-2 text-right font-mono">{issue.restartCount ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
