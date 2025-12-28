"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Timer,
  Activity
} from "lucide-react";
import { formatDistanceToNow, addDays, differenceInDays } from "date-fns";

interface Secret {
  id: string;
  name: string;
  type: string;
  environment: string;
  status: 'active' | 'expired' | 'rotating' | 'disabled';
  rotationEnabled: boolean;
  rotationInterval?: number;
  lastRotated?: Date;
  expiresAt?: Date;
  metadata: {
    description: string;
    owner: string;
    criticality: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface RotationJob {
  id: string;
  secretId: string;
  secretName: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  type: 'automatic' | 'manual';
}

interface SecretRotationProps {
  secrets: Secret[];
  onRotateSecret: (secretId: string) => void;
  onUpdateRotationConfig: (secretId: string, config: any) => void;
}

export function SecretRotation({ secrets, onRotateSecret, onUpdateRotationConfig }: SecretRotationProps) {
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [rotationJobs, setRotationJobs] = useState<RotationJob[]>([
    {
      id: 'job-001',
      secretId: 'secret-001',
      secretName: 'GitHub OAuth App Secret',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      duration: 3600000,
      type: 'automatic'
    },
    {
      id: 'job-002',
      secretId: 'secret-003',
      secretName: 'Stripe API Key',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      type: 'automatic'
    },
    {
      id: 'job-003',
      secretId: 'secret-010',
      secretName: 'SSH Deploy Key',
      status: 'running',
      scheduledAt: new Date(Date.now() - 10 * 60 * 1000),
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      type: 'manual'
    }
  ]);

  const getDaysUntilExpiration = (secret: Secret) => {
    if (!secret.expiresAt) return null;
    return differenceInDays(secret.expiresAt, new Date());
  };

  const getDaysUntilRotation = (secret: Secret) => {
    if (!secret.rotationEnabled || !secret.lastRotated || !secret.rotationInterval) return null;
    const nextRotation = addDays(secret.lastRotated, secret.rotationInterval);
    return differenceInDays(nextRotation, new Date());
  };

  const getRotationStatusColor = (daysUntil: number | null) => {
    if (daysUntil === null) return 'bg-gray-500/20 text-gray-400';
    if (daysUntil <= 7) return 'bg-red-500/20 text-red-400';
    if (daysUntil <= 14) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-green-500/20 text-green-400';
  };

  const getJobStatusIcon = (status: RotationJob['status']) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getJobStatusColor = (status: RotationJob['status']) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'running':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500';
    }
  };

  const handleRotateSecret = (secretId: string) => {
    const newJob: RotationJob = {
      id: `job-${Date.now()}`,
      secretId,
      secretName: secrets.find(s => s.id === secretId)?.name || 'Unknown',
      status: 'running',
      scheduledAt: new Date(),
      startedAt: new Date(),
      type: 'manual'
    };

    setRotationJobs(prev => [newJob, ...prev]);
    onRotateSecret(secretId);

    // Simulate job completion
    setTimeout(() => {
      setRotationJobs(prev => prev.map(job => 
        job.id === newJob.id 
          ? { 
              ...job, 
              status: 'completed', 
              completedAt: new Date(),
              duration: Date.now() - job.startedAt!.getTime()
            }
          : job
      ));
    }, 3000 + Math.random() * 2000);
  };

  // Calculate rotation statistics
  const totalRotationEnabled = secrets.filter(s => s.rotationEnabled).length;
  const dueForRotation = secrets.filter(s => {
    const daysUntil = getDaysUntilRotation(s);
    return daysUntil !== null && daysUntil <= 7;
  }).length;
  const expiringSoon = secrets.filter(s => {
    const daysUntil = getDaysUntilExpiration(s);
    return daysUntil !== null && daysUntil <= 30;
  }).length;
  const runningJobs = rotationJobs.filter(j => j.status === 'running').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            Secret Rotation Management
          </h2>
          <p className="text-gray-400 text-sm">
            Automated rotation schedules and lifecycle management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configure Policies
          </Button>
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Start Rotation
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalRotationEnabled}</p>
              <p className="text-sm text-gray-400">Auto-Rotation Enabled</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{dueForRotation}</p>
              <p className="text-sm text-gray-400">Due for Rotation</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{expiringSoon}</p>
              <p className="text-sm text-gray-400">Expiring Soon</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{runningJobs}</p>
              <p className="text-sm text-gray-400">Active Jobs</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Rotation Schedule */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Rotation Schedule</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {secrets.map(secret => {
            const daysUntilRotation = getDaysUntilRotation(secret);
            const daysUntilExpiration = getDaysUntilExpiration(secret);
            
            return (
              <Card key={secret.id} className="p-4 border-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{secret.name}</h4>
                    <p className="text-xs text-gray-400">{secret.metadata.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {secret.rotationEnabled ? (
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500">
                        <Pause className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Environment</span>
                    <Badge variant="secondary" className="capitalize">{secret.environment}</Badge>
                  </div>
                  
                  {secret.rotationEnabled && daysUntilRotation !== null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Next Rotation</span>
                      <Badge variant="outline" className={getRotationStatusColor(daysUntilRotation)}>
                        {daysUntilRotation <= 0 ? 'Overdue' : `${daysUntilRotation}d`}
                      </Badge>
                    </div>
                  )}

                  {daysUntilExpiration !== null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Expires</span>
                      <Badge variant="outline" className={getRotationStatusColor(daysUntilExpiration)}>
                        {daysUntilExpiration <= 0 ? 'Expired' : `${daysUntilExpiration}d`}
                      </Badge>
                    </div>
                  )}

                  {secret.lastRotated && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Last Rotated</span>
                      <span>{formatDistanceToNow(secret.lastRotated, { addSuffix: true })}</span>
                    </div>
                  )}
                </div>

                {/* Rotation Progress */}
                {secret.rotationEnabled && secret.rotationInterval && secret.lastRotated && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Rotation Cycle</span>
                      <span className="text-xs text-gray-400">
                        {Math.max(0, secret.rotationInterval - (daysUntilRotation || 0))} / {secret.rotationInterval} days
                      </span>
                    </div>
                    <Progress 
                      value={Math.max(0, ((secret.rotationInterval - (daysUntilRotation || 0)) / secret.rotationInterval) * 100)}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleRotateSecret(secret.id)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Rotate Now
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSecret(secret.id)}
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* Recent Rotation Jobs */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Recent Rotation Jobs</h3>
        </div>

        <div className="space-y-3">
          {rotationJobs.map(job => (
            <div key={job.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                {getJobStatusIcon(job.status)}
                <div>
                  <h4 className="font-medium text-sm">{job.secretName}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="capitalize">{job.type}</span>
                    <span>•</span>
                    <span>
                      {job.status === 'scheduled' 
                        ? `Scheduled ${formatDistanceToNow(job.scheduledAt, { addSuffix: true })}`
                        : job.status === 'running'
                        ? `Started ${formatDistanceToNow(job.startedAt!, { addSuffix: true })}`
                        : job.status === 'completed'
                        ? `Completed ${formatDistanceToNow(job.completedAt!, { addSuffix: true })}`
                        : `Failed ${formatDistanceToNow(job.scheduledAt, { addSuffix: true })}`
                      }
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {job.duration && (
                  <span className="text-xs text-gray-400">
                    {Math.round(job.duration / 1000)}s
                  </span>
                )}
                <Badge variant="outline" className={getJobStatusColor(job.status)}>
                  {job.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {rotationJobs.length === 0 && (
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No rotation jobs</h3>
            <p className="text-gray-500">Rotation jobs will appear here when secrets are rotated</p>
          </div>
        )}
      </Card>

      {/* Configuration Modal */}
      {selectedSecret && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Rotation Configuration</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const config = {
                  rotationEnabled: formData.get('enabled') === 'on',
                  rotationInterval: parseInt(formData.get('interval') as string),
                  notifyBefore: parseInt(formData.get('notifyBefore') as string),
                };
                onUpdateRotationConfig(selectedSecret, config);
                setSelectedSecret(null);
              }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <input type="checkbox" id="enabled" name="enabled" defaultChecked />
                <label htmlFor="enabled" className="text-sm">Enable automatic rotation</label>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Rotation Interval (days)</label>
                <input
                  type="number"
                  name="interval"
                  min="1"
                  max="365"
                  defaultValue="90"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notify Before (days)</label>
                <input
                  type="number"
                  name="notifyBefore"
                  min="1"
                  max="30"
                  defaultValue="7"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button type="submit" className="flex-1">
                  Save Configuration
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedSecret(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}