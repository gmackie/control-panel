'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Server,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  Filter,
} from 'lucide-react';
import type { DiscoveredApplication } from '@/lib/applications/discovery';

interface ImportApplicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportApplicationsModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportApplicationsModalProps) {
  const queryClient = useQueryClient();
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [includeManaged, setIncludeManaged] = useState(false);
  const [includeSystem, setIncludeSystem] = useState(false);

  // Fetch discovered applications
  const {
    data: discoveryData,
    isLoading: isDiscovering,
    error: discoveryError,
    refetch: rediscover,
  } = useQuery({
    queryKey: ['discover-applications', includeManaged, includeSystem],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeManaged) params.append('includeManaged', 'true');
      if (includeSystem) params.append('includeSystem', 'true');

      const response = await fetch(`/api/applications/discover?${params}`);
      if (!response.ok) {
        throw new Error('Failed to discover applications');
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (apps: DiscoveredApplication[]) => {
      if (apps.length === 1) {
        // Single import
        const response = await fetch('/api/applications/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discoveredApp: apps[0] }),
        });
        if (!response.ok) {
          throw new Error('Failed to import application');
        }
        return response.json();
      } else {
        // Bulk import
        const response = await fetch('/api/applications/import/bulk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discoveredApps: apps }),
        });
        if (!response.ok) {
          throw new Error('Failed to import applications');
        }
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      if (onSuccess) {
        onSuccess();
      }
      setSelectedApps(new Set());
    },
  });

  const discoveredApps: DiscoveredApplication[] = discoveryData?.applications || [];

  // Filter applications based on search
  const filteredApps = discoveredApps.filter((app) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      app.name.toLowerCase().includes(searchLower) ||
      app.namespace.toLowerCase().includes(searchLower) ||
      app.clusterName.toLowerCase().includes(searchLower) ||
      app.description?.toLowerCase().includes(searchLower)
    );
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(
        filteredApps.map((app) => `${app.clusterName}/${app.namespace}/${app.name}`)
      );
      setSelectedApps(newSelected);
    } else {
      setSelectedApps(new Set());
    }
  };

  const handleSelectApp = (app: DiscoveredApplication, checked: boolean) => {
    const key = `${app.clusterName}/${app.namespace}/${app.name}`;
    const newSelected = new Set(selectedApps);
    if (checked) {
      newSelected.add(key);
    } else {
      newSelected.delete(key);
    }
    setSelectedApps(newSelected);
  };

  const handleImport = () => {
    const appsToImport = filteredApps.filter((app) =>
      selectedApps.has(`${app.clusterName}/${app.namespace}/${app.name}`)
    );
    importMutation.mutate(appsToImport);
  };

  const isAppSelected = (app: DiscoveredApplication) => {
    return selectedApps.has(`${app.clusterName}/${app.namespace}/${app.name}`);
  };

  const getStatusBadge = (app: DiscoveredApplication) => {
    if (app.managedByControlPanel) {
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Managed
        </Badge>
      );
    }
    if (app.replicas.ready === app.replicas.desired && app.replicas.ready > 0) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle2 className="h-3 w-3" />
          Healthy
        </Badge>
      );
    }
    if (app.replicas.ready > 0) {
      return (
        <Badge variant="default" className="gap-1 bg-yellow-500">
          <AlertTriangle className="h-3 w-3" />
          Degraded
        </Badge>
      );
    }
    return (
      <Badge variant="error" className="gap-1">
        <XCircle className="h-3 w-3" />
        Down
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Applications from Kubernetes
          </DialogTitle>
          <DialogDescription>
            Discover and import existing applications running in your Kubernetes clusters.
            Applications will be added to the control panel for management.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Filters and Search */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search Applications</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, namespace, or cluster..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-managed"
                  checked={includeManaged}
                  onCheckedChange={(checked) => setIncludeManaged(checked as boolean)}
                />
                <Label htmlFor="include-managed" className="text-sm cursor-pointer">
                  Show managed apps
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-system"
                  checked={includeSystem}
                  onCheckedChange={(checked) => setIncludeSystem(checked as boolean)}
                />
                <Label htmlFor="include-system" className="text-sm cursor-pointer">
                  Show system namespaces
                </Label>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => rediscover()}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {discoveryError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {discoveryError instanceof Error
                  ? discoveryError.message
                  : 'Failed to discover applications'}
              </AlertDescription>
            </Alert>
          )}

          {/* Import Error */}
          {importMutation.isError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {importMutation.error instanceof Error
                  ? importMutation.error.message
                  : 'Failed to import applications'}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {importMutation.isSuccess && (
            <Alert className="border-green-500 text-green-900 dark:text-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Successfully imported {selectedApps.size} application(s)
              </AlertDescription>
            </Alert>
          )}

          {/* Applications Table */}
          <div className="flex-1 border rounded-md overflow-auto">
            {isDiscovering ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Server className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No applications found</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'No deployments found in the cluster'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedApps.size > 0 &&
                          selectedApps.size === filteredApps.length
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Namespace</TableHead>
                    <TableHead>Cluster</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Replicas</TableHead>
                    <TableHead>Image</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.map((app) => {
                    const key = `${app.clusterName}/${app.namespace}/${app.name}`;
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Checkbox
                            checked={isAppSelected(app)}
                            onCheckedChange={(checked) =>
                              handleSelectApp(app, checked as boolean)
                            }
                            disabled={app.managedByControlPanel}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{app.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{app.namespace}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{app.clusterName}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(app)}</TableCell>
                        <TableCell>
                          {app.replicas.ready}/{app.replicas.desired}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {app.image || 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedApps.size > 0 ? (
                <span>
                  {selectedApps.size} of {filteredApps.length} selected
                </span>
              ) : (
                <span>{filteredApps.length} applications discovered</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedApps.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import {selectedApps.size > 0 ? `(${selectedApps.size})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
