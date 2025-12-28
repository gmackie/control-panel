'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Server, 
  Cpu, 
  MemoryStick, 
  HardDrive,
  Network,
  Power,
  PowerOff,
  Pause,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Settings,
  Terminal,
  Eye
} from 'lucide-react'

interface KubernetesNode {
  name: string
  status: 'Ready' | 'NotReady' | 'Unknown' | 'SchedulingDisabled'
  roles: string[]
  age: string
  version: string
  internalIP: string
  externalIP?: string
  usage: {
    cpu: number
    memory: number
    pods: number
    storage: number
  }
  capacity: {
    cpu: string
    memory: string
    pods: string
  }
  conditions: Array<{
    type: string
    status: string
    lastTransitionTime: string
    reason: string
    message: string
  }>
  createdAt: string
  lastHeartbeat: string
}

interface ClusterSummary {
  totalNodes: number
  readyNodes: number
  averageCpuUsage: number
  averageMemoryUsage: number
  totalPods: number
}

interface NodeOperationResult {
  success: boolean
  message: string
  jobId?: string
}

const statusColors = {
  'Ready': 'text-green-600 bg-green-50 border-green-200',
  'NotReady': 'text-red-600 bg-red-50 border-red-200',
  'Unknown': 'text-gray-600 bg-gray-50 border-gray-200',
  'SchedulingDisabled': 'text-yellow-600 bg-yellow-50 border-yellow-200'
}

const statusIcons = {
  'Ready': <CheckCircle className="h-4 w-4 text-green-500" />,
  'NotReady': <AlertTriangle className="h-4 w-4 text-red-500" />,
  'Unknown': <Clock className="h-4 w-4 text-gray-500" />,
  'SchedulingDisabled': <Pause className="h-4 w-4 text-yellow-500" />
}

function NodeCard({ node, onAction }: { 
  node: KubernetesNode
  onAction: (action: string, nodeName: string) => void 
}) {
  const [showDetails, setShowDetails] = useState(false)
  const isMaster = node.roles.includes('master') || node.roles.includes('control-plane')
  const isReady = node.status === 'Ready'
  const isSchedulable = node.status !== 'SchedulingDisabled'

  return (
    <Card className={`${statusColors[node.status]} transition-all duration-200 hover:shadow-md`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {statusIcons[node.status]}
            <CardTitle className="text-sm">{node.name}</CardTitle>
            <Badge variant={isMaster ? 'default' : 'secondary'} className="text-xs">
              {isMaster ? 'Master' : 'Worker'}
            </Badge>
          </div>
          <Badge variant={isReady ? 'default' : 'error'}>
            {node.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Resource Usage */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>CPU Usage</span>
              <span>{node.usage.cpu.toFixed(1)}%</span>
            </div>
            <Progress value={node.usage.cpu} className="h-1" />
            
            <div className="flex justify-between text-xs">
              <span>Memory Usage</span>
              <span>{node.usage.memory.toFixed(1)}%</span>
            </div>
            <Progress value={node.usage.memory} className="h-1" />
            
            <div className="flex justify-between text-xs">
              <span>Pods</span>
              <span>{node.usage.pods}/{node.capacity.pods}</span>
            </div>
            <Progress value={(node.usage.pods / parseInt(node.capacity.pods)) * 100} className="h-1" />
          </div>

          {/* Node Info */}
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Version:</span>
              <div className="font-mono">{node.version}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Age:</span>
              <div>{node.age}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Internal IP:</span>
              <div className="font-mono">{node.internalIP}</div>
            </div>
            <div>
              <span className="text-muted-foreground">CPU Capacity:</span>
              <div>{node.capacity.cpu} cores</div>
            </div>
          </div>

          {/* Actions */}
          <Separator />
          <div className="flex flex-wrap gap-2">
            {showDetails && <Dialog>
              <DialogTrigger>
                <Button size="sm" variant="outline">
                  <Eye className="h-3 w-3 mr-1" />
                  Details
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Node Details: {node.name}</DialogTitle>
                  <DialogDescription>
                    Detailed information and conditions for {node.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Basic Information</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Status:</strong> {node.status}</div>
                        <div><strong>Roles:</strong> {node.roles.join(', ')}</div>
                        <div><strong>Version:</strong> {node.version}</div>
                        <div><strong>Created:</strong> {new Date(node.createdAt).toLocaleString()}</div>
                        <div><strong>Last Heartbeat:</strong> {new Date(node.lastHeartbeat).toLocaleString()}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Network</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Internal IP:</strong> {node.internalIP}</div>
                        {node.externalIP && <div><strong>External IP:</strong> {node.externalIP}</div>}
                      </div>
                      <h4 className="font-semibold mb-2 mt-4">Capacity</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>CPU:</strong> {node.capacity.cpu} cores</div>
                        <div><strong>Memory:</strong> {node.capacity.memory}</div>
                        <div><strong>Max Pods:</strong> {node.capacity.pods}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Conditions</h4>
                    <div className="space-y-2">
                      {node.conditions.map((condition, index) => (
                        <div key={index} className="border rounded p-2">
                          <div className="flex justify-between items-center">
                            <div className="font-medium">{condition.type}</div>
                            <Badge variant={condition.status === 'True' ? 'default' : 'secondary'}>
                              {condition.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <div><strong>Reason:</strong> {condition.reason}</div>
                            <div><strong>Message:</strong> {condition.message}</div>
                            <div><strong>Last Transition:</strong> {new Date(condition.lastTransitionTime).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>}

            {!isMaster && (
              <>
                {isSchedulable ? (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onAction('cordon', node.name)}
                  >
                    <Pause className="h-3 w-3 mr-1" />
                    Cordon
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onAction('uncordon', node.name)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Uncordon
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAction('drain', node.name)}
                >
                  <PowerOff className="h-3 w-3 mr-1" />
                  Drain
                </Button>
              </>
            )}
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onAction('reboot', node.name)}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reboot
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

async function fetchNodes() {
  const response = await fetch('/api/cluster/nodes')
  if (!response.ok) throw new Error('Failed to fetch nodes')
  return response.json()
}

async function executeNodeAction(action: string, nodeName: string): Promise<NodeOperationResult> {
  const response = await fetch('/api/cluster/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, nodeName })
  })
  
  if (!response.ok) throw new Error('Failed to execute node action')
  return response.json()
}

export default function ClusterManagement() {
  const queryClient = useQueryClient()
  const [selectedNode, setSelectedNode] = useState<string>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['cluster-nodes'],
    queryFn: fetchNodes,
    refetchInterval: 30000
  })

  const nodeActionMutation = useMutation({
    mutationFn: ({ action, nodeName }: { action: string; nodeName: string }) =>
      executeNodeAction(action, nodeName),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cluster-nodes'] })
      // You could add a toast notification here
      console.log('Node action completed:', result.message)
    },
    onError: (error) => {
      console.error('Node action failed:', error)
      // You could add an error toast here
    }
  })

  const handleNodeAction = (action: string, nodeName: string) => {
    nodeActionMutation.mutate({ action, nodeName })
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load cluster information. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  const nodes = data?.nodes || []
  const summary = data?.summary || {}
  const masterNodes = nodes.filter((node: KubernetesNode) => 
    node.roles.includes('master') || node.roles.includes('control-plane')
  )
  const workerNodes = nodes.filter((node: KubernetesNode) => 
    !node.roles.includes('master') && !node.roles.includes('control-plane')
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cluster Management</h2>
          <p className="text-muted-foreground">
            Manage and monitor your Kubernetes cluster nodes
          </p>
        </div>
        <Button variant="outline">
          <Terminal className="h-4 w-4 mr-2" />
          kubectl Shell
        </Button>
      </div>

      {/* Cluster Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{summary.totalNodes || 0}</div>
                <div className="text-sm text-muted-foreground">Total Nodes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{summary.readyNodes || 0}</div>
                <div className="text-sm text-muted-foreground">Ready Nodes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{summary.averageCpuUsage?.toFixed(1) || 0}%</div>
                <div className="text-sm text-muted-foreground">Avg CPU</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MemoryStick className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{summary.averageMemoryUsage?.toFixed(1) || 0}%</div>
                <div className="text-sm text-muted-foreground">Avg Memory</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              <div>
                <div className="text-2xl font-bold">{summary.totalPods || 0}</div>
                <div className="text-sm text-muted-foreground">Total Pods</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Nodes</TabsTrigger>
          <TabsTrigger value="masters">Master Nodes ({masterNodes.length})</TabsTrigger>
          <TabsTrigger value="workers">Worker Nodes ({workerNodes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {nodes.map((node: KubernetesNode) => (
              <NodeCard
                key={node.name}
                node={node}
                onAction={handleNodeAction}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="masters">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {masterNodes.map((node: KubernetesNode) => (
              <NodeCard
                key={node.name}
                node={node}
                onAction={handleNodeAction}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workers">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {workerNodes.map((node: KubernetesNode) => (
              <NodeCard
                key={node.name}
                node={node}
                onAction={handleNodeAction}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {nodeActionMutation.isPending && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            Executing node operation... Please wait.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}