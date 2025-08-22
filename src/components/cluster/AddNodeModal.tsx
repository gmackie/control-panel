"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Server, MapPin, Key, DollarSign } from "lucide-react";
import { ServerType, Location } from "@/types/cluster";

interface AddNodeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddNodeModal({ onClose, onSuccess }: AddNodeModalProps) {
  const queryClient = useQueryClient();
  const [nodeType, setNodeType] = useState<'master' | 'worker'>('worker');
  const [serverType, setServerType] = useState<string>('cx22');
  const [location, setLocation] = useState<string>('fsn1');

  // Fetch server types
  const { data: serverTypes } = useQuery<ServerType[]>({
    queryKey: ['hetzner', 'server-types'],
    queryFn: async () => {
      const res = await fetch('/api/cluster/server-types');
      if (!res.ok) throw new Error('Failed to fetch server types');
      return res.json();
    },
  });

  // Fetch locations
  const { data: locations } = useQuery<Location[]>({
    queryKey: ['hetzner', 'locations'],
    queryFn: async () => {
      const res = await fetch('/api/cluster/locations');
      if (!res.ok) throw new Error('Failed to fetch locations');
      return res.json();
    },
  });

  const addNodeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/cluster/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          nodeType,
          serverType,
          location,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add node');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster'] });
      onSuccess();
    },
  });

  const selectedServerType = serverTypes?.find(st => st.name === serverType);
  const selectedLocation = locations?.find(l => l.name === location);

  const estimatedCost = selectedServerType?.prices.find(
    p => p.location === location
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Add New Node</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Node Type */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Node Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNodeType('master')}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    nodeType === 'master'
                      ? 'border-blue-500 bg-blue-950/20'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="font-medium">Master Node</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Control plane node for managing the cluster
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setNodeType('worker')}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    nodeType === 'worker'
                      ? 'border-blue-500 bg-blue-950/20'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="font-medium">Worker Node</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Run your applications and workloads
                  </div>
                </button>
              </div>
            </div>

            {/* Server Type */}
            <div>
              <label className="block text-sm font-medium mb-3">
                <Server className="inline h-4 w-4 mr-1" />
                Server Type
              </label>
              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {serverTypes?.map((st) => (
                  <button
                    key={st.name}
                    type="button"
                    onClick={() => setServerType(st.name)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      serverType === st.name
                        ? 'border-blue-500 bg-blue-950/20'
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{st.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {st.cores} vCPU, {st.memory}GB RAM
                    </div>
                    <div className="text-xs text-gray-500">
                      {st.disk}GB {st.architecture === 'arm' ? 'ARM' : 'SSD'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-3">
                <MapPin className="inline h-4 w-4 mr-1" />
                Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
              >
                {locations?.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.city}, {loc.country} ({loc.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Cost Estimate */}
            {estimatedCost && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Estimated Cost
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Based on selected configuration
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      €{estimatedCost.price_monthly.gross}/mo
                    </p>
                    <p className="text-xs text-gray-400">
                      €{estimatedCost.price_hourly.gross}/hour
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Server Details */}
            {selectedServerType && (
              <div className="p-4 bg-gray-900 rounded-lg space-y-2">
                <h4 className="font-medium text-sm mb-2">Server Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">CPU:</span> {selectedServerType.cores} cores ({selectedServerType.cpu_type})
                  </div>
                  <div>
                    <span className="text-gray-400">Memory:</span> {selectedServerType.memory} GB
                  </div>
                  <div>
                    <span className="text-gray-400">Storage:</span> {selectedServerType.disk} GB
                  </div>
                  <div>
                    <span className="text-gray-400">Traffic:</span> {selectedServerType.traffic} TB
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-800">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => addNodeMutation.mutate()}
              disabled={addNodeMutation.isPending}
            >
              {addNodeMutation.isPending ? 'Creating...' : 'Create Node'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}