"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Plus,
  MessageSquare,
  User,
  Calendar
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  startedAt: Date;
  resolvedAt?: Date;
  impact: string;
  updates: IncidentUpdate[];
}

interface IncidentUpdate {
  id: string;
  timestamp: Date;
  status: Incident['status'];
  message: string;
  user: string;
}

interface IncidentManagementProps {
  incidents: Incident[];
  services: Array<{ id: string; name: string; }>;
  onCreateIncident: (incident: Partial<Incident>) => void;
  onUpdateIncident: (incidentId: string, update: Partial<IncidentUpdate>) => void;
}

export function IncidentManagement({ 
  incidents, 
  services, 
  onCreateIncident, 
  onUpdateIncident 
}: IncidentManagementProps) {
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  const getSeverityIcon = (severity: Incident['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: Incident['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
    }
  };

  const getStatusIcon = (status: Incident['status']) => {
    switch (status) {
      case 'investigating':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'identified':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'monitoring':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusColor = (status: Incident['status']) => {
    switch (status) {
      case 'investigating':
        return 'bg-red-500/20 text-red-400';
      case 'identified':
        return 'bg-orange-500/20 text-orange-400';
      case 'monitoring':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'resolved':
        return 'bg-green-500/20 text-green-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Incident Management</h2>
          <p className="text-gray-400 text-sm">
            {activeIncidents.length} active incidents, {resolvedIncidents.length} resolved
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Incident
        </Button>
      </div>

      {/* Active Incidents */}
      {activeIncidents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Active Incidents
          </h3>
          
          {activeIncidents.map(incident => (
            <Card key={incident.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getSeverityIcon(incident.severity)}
                    <h4 className="font-semibold">{incident.title}</h4>
                    <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                      {incident.severity}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(incident.status)}>
                      {getStatusIcon(incident.status)}
                      {incident.status}
                    </Badge>
                  </div>

                  <p className="text-gray-400 text-sm mb-3">{incident.impact}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Started {formatDistanceToNow(incident.startedAt, { addSuffix: true })}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {incident.updates.length} updates
                    </div>
                  </div>

                  {/* Affected Services */}
                  {incident.affectedServices.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Affected Services:</p>
                      <div className="flex flex-wrap gap-1">
                        {incident.affectedServices.map(serviceId => {
                          const service = services.find(s => s.id === serviceId);
                          return (
                            <Badge key={serviceId} variant="secondary" className="text-xs">
                              {service?.name || serviceId}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Latest Update */}
                  {incident.updates.length > 0 && (
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {incident.updates[0].user} • {formatDistanceToNow(incident.updates[0].timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{incident.updates[0].message}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIncident(incident.id)}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Add update form logic
                      console.log('Add update to incident:', incident.id);
                    }}
                  >
                    Add Update
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* No Active Incidents */}
      {activeIncidents.length === 0 && (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">All Systems Operational</h3>
          <p className="text-gray-400">No active incidents at this time</p>
        </Card>
      )}

      {/* Recent Resolved Incidents */}
      {resolvedIncidents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Recent Resolved Incidents
          </h3>
          
          <div className="space-y-2">
            {resolvedIncidents.slice(0, 5).map(incident => (
              <Card key={incident.id} className="p-3 opacity-75">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <h4 className="font-medium text-sm">{incident.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                          {incident.severity}
                        </Badge>
                        <span>
                          {incident.resolvedAt 
                            ? `Resolved ${formatDistanceToNow(incident.resolvedAt, { addSuffix: true })}`
                            : 'Resolution time unknown'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIncident(incident.id)}
                  >
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create Incident Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Incident</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                onCreateIncident({
                  title: formData.get('title') as string,
                  severity: formData.get('severity') as Incident['severity'],
                  impact: formData.get('impact') as string,
                  status: 'investigating',
                  startedAt: new Date(),
                  affectedServices: [],
                  updates: [],
                });
                setShowCreateForm(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                  placeholder="Brief description of the incident"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Severity</label>
                <select
                  name="severity"
                  required
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Impact Description</label>
                <textarea
                  name="impact"
                  required
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md"
                  placeholder="Describe the impact on users/services"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button type="submit" className="flex-1">
                  Create Incident
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
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