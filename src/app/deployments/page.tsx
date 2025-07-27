'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchRecentDeployments } from '@/lib/api'
import { Deployment } from '@/types'
import { GitBranch, GitCommit, Clock, ExternalLink, CheckCircle, XCircle, Clock3, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DeploymentsPage() {
  const { data: deployments, isLoading } = useQuery<Deployment[]>({
    queryKey: ['recent-deployments'],
    queryFn: fetchRecentDeployments,
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Deployments</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-800 rounded-lg"></div>
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
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold">Deployments</h1>
        </div>
        <div className="flex items-center space-x-4">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm">
            <option value="all">All Environments</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm">
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {!deployments || deployments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            No deployments found
          </div>
        ) : (
          deployments.map((deployment) => (
            <div
              key={deployment.id}
              className="card hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-semibold">{deployment.name}</h3>
                    <span
                      className={`status-badge ${
                        environmentColor[deployment.environment]
                      }`}
                    >
                      {deployment.environment}
                    </span>
                    <span className="text-gray-500">in {deployment.namespace}</span>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-400">
                    <span className="flex items-center">
                      <GitBranch className="h-4 w-4 mr-1" />
                      {deployment.branch}
                    </span>
                    <span className="flex items-center">
                      <GitCommit className="h-4 w-4 mr-1" />
                      {deployment.commit}
                    </span>
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatTime(deployment.timestamp)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {statusIcon[deployment.status]}
                  <span className={`text-sm font-medium ${statusColor[deployment.status]}`}>
                    {deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-gray-300">{deployment.commitMessage}</p>
                <p className="text-sm text-gray-500">
                  by {deployment.author} from {deployment.repository}
                </p>
              </div>

              {deployment.url && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <Link
                    href={deployment.url}
                    target="_blank"
                    className="text-blue-500 hover:text-blue-400 flex items-center text-sm"
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