"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  BellOff,
  MoreVertical,
  Plus,
  Edit,
  Trash,
  Copy,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Zap,
} from "lucide-react";
import { AlertRule } from "@/types/alerts";
import { AlertRuleForm } from "./alert-rule-form";

export function AlertRulesList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const { data: rules, isLoading } = useQuery<AlertRule[]>({
    queryKey: ["alert-rules"],
    queryFn: async () => {
      const response = await fetch("/api/alerts/rules");
      if (!response.ok) throw new Error("Failed to fetch alert rules");
      return response.json();
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await fetch(`/api/alerts/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error("Failed to update rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/alerts/rules/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "error";
      case "warning":
        return "warning";
      case "info":
        return "secondary";
      default:
        return "default";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "threshold":
        return <Zap className="h-4 w-4" />;
      case "availability":
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Alert Rules</h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure rules to monitor your services and get notified of issues
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingRule(null);
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>

        {rules && rules.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Triggers</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-sm text-gray-400">
                          {rule.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(rule.type)}
                      <span className="capitalize">{rule.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityColor(rule.severity) as any}>
                      <span className="flex items-center gap-1">
                        {getSeverityIcon(rule.severity)}
                        {rule.severity}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{rule.target.name}</div>
                      <div className="text-gray-400">{rule.target.type}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {rule.actions.map((action, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {action.type}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleRuleMutation.mutate({
                          id: rule.id,
                          enabled: !rule.enabled,
                        })
                      }
                    >
                      {rule.enabled ? (
                        <Bell className="h-4 w-4 text-green-500" />
                      ) : (
                        <BellOff className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm">
                      <div className="font-medium">{rule.triggerCount}</div>
                      {rule.lastTriggered && (
                        <div className="text-gray-400">
                          {new Date(rule.lastTriggered).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingRule(rule);
                            setShowForm(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            // Clone rule
                            setEditingRule({ ...rule, id: "", name: `${rule.name} (Copy)` });
                            setShowForm(true);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          className="text-red-500"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No alert rules configured</h3>
            <p className="text-gray-400 mb-4">
              Create your first alert rule to start monitoring your services
            </p>
            <Button
              onClick={() => {
                setEditingRule(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Rule
            </Button>
          </div>
        )}
      </Card>

      {showForm && (
        <AlertRuleForm
          rule={editingRule}
          onClose={() => {
            setShowForm(false);
            setEditingRule(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingRule(null);
            queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
          }}
        />
      )}
    </>
  );
}