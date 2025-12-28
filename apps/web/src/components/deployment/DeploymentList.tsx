"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink, Server, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Deployment {
  name: string;
  namespace: string;
  url: string | null;
  domains: string[];
  tls: boolean;
  podCount: number;
  healthy: boolean;
  argocd: {
    syncStatus: string;
    healthStatus: string;
    repo: string;
  } | null;
  createdAt: string;
}

export function DeploymentList() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeployments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/deployment/list');
      if (!response.ok) throw new Error('Failed to fetch deployments');
      
      const data = await response.json();
      setDeployments(data.deployments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deployments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const getHealthBadge = (deployment: Deployment) => {
    if (!deployment.healthy) {
      return <Badge variant="secondary">Unhealthy</Badge>;
    }
    if (deployment.argocd?.healthStatus === 'Healthy' && deployment.argocd?.syncStatus === 'Synced') {
      return <Badge variant="default">Healthy</Badge>;
    }
    if (deployment.argocd?.syncStatus === 'OutOfSync') {
      return <Badge variant="outline">Out of Sync</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  const getStatusIcon = (deployment: Deployment) => {
    if (!deployment.healthy) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (deployment.argocd?.healthStatus === 'Healthy') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deployed Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deployed Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchDeployments} variant="outline" size="sm" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Server className="h-6 w-6" />
          Deployed Applications ({deployments.length})
        </CardTitle>
        <Button onClick={fetchDeployments} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {deployments.length === 0 ? (
          <div className="text-center py-8">
            <Server className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No applications deployed yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deployments.map((deployment) => (
              <div
                key={`${deployment.namespace}-${deployment.name}`}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(deployment)}
                    <h4 className="font-medium">{deployment.name}</h4>
                    {getHealthBadge(deployment)}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Namespace: {deployment.namespace}</p>
                    <p>Pods: {deployment.podCount}</p>
                    {deployment.domains.length > 0 && (
                      <p>Domains: {deployment.domains.join(', ')}</p>
                    )}
                    {deployment.tls && (
                      <Badge variant="outline" className="text-xs">
                        SSL Enabled
                      </Badge>
                    )}
                  </div>

                  {deployment.argocd && (
                    <div className="flex gap-2 mt-2">
                      <Badge variant={deployment.argocd.syncStatus === 'Synced' ? 'secondary' : 'outline'}>
                        {deployment.argocd.syncStatus}
                      </Badge>
                    </div>
                  )}
                </div>

                {deployment.url && (
                  <a
                    href={deployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}