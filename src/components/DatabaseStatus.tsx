'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchTursoDatabases } from '@/lib/api'
import { TursoDatabase } from '@/types'
import { Database, HardDrive, Activity, AlertCircle, CheckCircle, Globe } from 'lucide-react'

export default function DatabaseStatus() {
  const { data: databases, isLoading } = useQuery<TursoDatabase[]>({
    queryKey: ['turso-databases'],
    queryFn: fetchTursoDatabases,
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="card-header">Database Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const statusIcon = {
    healthy: <CheckCircle className="h-5 w-5 text-green-500" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="card">
      <h2 className="card-header flex items-center">
        <Database className="h-5 w-5 mr-2 text-green-500" />
        Turso Databases
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {databases?.map((db) => (
          <div key={db.id} className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{db.name}</h3>
                <p className="text-xs text-gray-400">{db.appId}</p>
              </div>
              {statusIcon[db.status]}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center">
                  <Globe className="h-3 w-3 mr-1" />
                  Location
                </span>
                <span>{db.location}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center">
                  <HardDrive className="h-3 w-3 mr-1" />
                  Size
                </span>
                <span>{formatSize(db.size)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center">
                  <Activity className="h-3 w-3 mr-1" />
                  Connections
                </span>
                <span>{db.connections}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2">Operations (24h)</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Reads</p>
                  <p className="font-medium text-green-500">{formatNumber(db.operations.reads)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Writes</p>
                  <p className="font-medium text-blue-500">{formatNumber(db.operations.writes)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Database Summary */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-2xl font-bold">{databases?.length || 0}</p>
          <p className="text-xs text-gray-400">Total Databases</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-500">
            {databases?.filter(db => db.status === 'healthy').length || 0}
          </p>
          <p className="text-xs text-gray-400">Healthy</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-2xl font-bold">
            {formatSize(databases?.reduce((acc, db) => acc + db.size, 0) || 0)}
          </p>
          <p className="text-xs text-gray-400">Total Size</p>
        </div>
      </div>
    </div>
  )
}