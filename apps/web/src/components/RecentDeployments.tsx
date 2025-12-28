'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchRecentDeployments } from '@/lib/api'
import { Deployment } from '@/types'
import { GitBranch, GitCommit, Clock, ExternalLink, CheckCircle, XCircle, Clock3 } from 'lucide-react'
import Link from 'next/link'

export default function RecentDeployments() {
  const { data: deployments, isLoading } = useQuery<Deployment[]>({
    queryKey: ['recent-deployments'],
    queryFn: fetchRecentDeployments,
    refetchInterval: 60000, // Refresh every minute
  })

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="card-header">Recent Deployments</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const statusIcon = {
    running: <CheckCircle className="h-5 w-5 text-green-500" />,
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    pending: <Clock3 className="h-5 w-5 text-yellow-500" />,
    failed: <XCircle className="h-5 w-5 text-red-500" />,
  }

  const statusColor = {
    running: 'text-green-500',
    success: 'text-green-500',
    pending: 'text-yellow-500',
    failed: 'text-red-500',
  }

  const environmentColor = {
    production: 'bg-red-900/20 text-red-400 border-red-900',
    staging: 'bg-yellow-900/20 text-yellow-400 border-yellow-900',
    development: 'bg-blue-900/20 text-blue-400 border-blue-900',
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Recent Deployments</h2>
        <Link
          href="/deployments"
          className="text-sm text-blue-500 hover:text-blue-400 flex items-center"
        >
          View all
          <ExternalLink className="h-3 w-3 ml-1" />
        </Link>
      </div>

      <div className="space-y-4">
        {!deployments || deployments.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No recent deployments
          </div>
        ) : (
          deployments.slice(0, 5).map((deployment) => (
            <div
              key={deployment.id}
              className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <h3 className="font-semibold">{deployment.name}</h3>
                    <span
                      className={`status-badge ${
                        environmentColor[deployment.environment]
                      }`}
                    >
                      {deployment.environment}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <span className="flex items-center">
                      <GitBranch className="h-3 w-3 mr-1" />
                      {deployment.branch}
                    </span>
                    <span className="flex items-center">
                      <GitCommit className="h-3 w-3 mr-1" />
                      {deployment.commit.substring(0, 7)}
                    </span>
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTime(deployment.timestamp)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {statusIcon[deployment.status]}
                  <span className={`text-sm font-medium ${statusColor[deployment.status]}`}>
                    {deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-300 line-clamp-1">
                  {deployment.commitMessage}
                </p>
                <p className="text-xs text-gray-500">by {deployment.author}</p>
              </div>

              {deployment.url && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <Link
                    href={deployment.url}
                    target="_blank"
                    className="text-sm text-blue-500 hover:text-blue-400 flex items-center"
                  >
                    View deployment
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}