'use client';

import React, { useState, useEffect } from 'react';
import { UnifiedApplicationDashboard } from '@/components/monitoring/UnifiedApplicationDashboard';
import { ApplicationMonitoring } from '@/lib/monitoring/application-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Server,
  Layers,
  Monitor,
  RefreshCw
} from 'lucide-react';

interface MonitoringData {
  applications: ApplicationMonitoring[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    critical: number;
    unknown: number;
    totalPods: number;
    runningPods: number;
    totalRestarts: number;
  };
  lastUpdate: string;
  cluster: string;
  namespace: string;
}

export default function MonitoringPage() {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [selectedNamespace, setSelectedNamespace] = useState('default');
  const [refreshing, setRefreshing] = useState(false);

  const fetchMonitoringData = async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams({
        cluster: selectedCluster,
        namespace: selectedNamespace,
      });
      
      const response = await fetch(`/api/monitoring/applications?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data');
      }
      
      const data = await response.json();
      setMonitoringData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, [selectedCluster, selectedNamespace]);

  const handleRefresh = () => {
    fetchMonitoringData();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Loading monitoring data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Error Loading Monitoring Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!monitoringData) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Application Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor Git repos, Helm charts, pods, and observability across all environments
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <UnifiedApplicationDashboard 
        applications={monitoringData.applications}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
