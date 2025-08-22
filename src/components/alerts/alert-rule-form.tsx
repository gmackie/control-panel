"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash } from "lucide-react";
import { AlertRule, AlertCondition, AlertAction, ALERT_TEMPLATES } from "@/types/alerts";

interface AlertRuleFormProps {
  rule?: AlertRule | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AlertRuleForm({ rule, onClose, onSuccess }: AlertRuleFormProps) {
  const isEditing = !!rule?.id;
  const [formData, setFormData] = useState({
    name: rule?.name || "",
    description: rule?.description || "",
    enabled: rule?.enabled ?? true,
    severity: rule?.severity || "warning",
    type: rule?.type || "threshold",
    target: rule?.target || { type: "service", name: "" },
    conditions: rule?.conditions || [
      { id: "1", type: "metric", operator: "gt", value: 0 },
    ],
    actions: rule?.actions || [
      { id: "1", type: "email", enabled: true, config: {} },
    ],
    cooldown: rule?.cooldown || 15,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEditing ? `/api/alerts/rules/${rule.id}` : "/api/alerts/rules";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error("Failed to save rule");
      return response.json();
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const applyTemplate = (templateId: string) => {
    const template = ALERT_TEMPLATES.find((t) => t.id === templateId);
    if (template && template.rule) {
      setFormData({
        ...formData,
        ...template.rule,
        name: formData.name || template.rule.name || "",
      });
      setSelectedTemplate(templateId);
    }
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        {
          id: Date.now().toString(),
          type: "metric",
          operator: "gt",
          value: 0,
        },
      ],
    });
  };

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index: number, updates: Partial<AlertCondition>) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setFormData({ ...formData, conditions: newConditions });
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [
        ...formData.actions,
        {
          id: Date.now().toString(),
          type: "email",
          enabled: true,
          config: {},
        },
      ],
    });
  };

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    });
  };

  const updateAction = (index: number, updates: Partial<AlertAction>) => {
    const newActions = [...formData.actions];
    newActions[index] = { ...newActions[index], ...updates };
    setFormData({ ...formData, actions: newActions });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {isEditing ? "Edit Alert Rule" : "Create Alert Rule"}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!isEditing && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Start from template (optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {ALERT_TEMPLATES.filter((t) => t.recommended).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedTemplate === template.id
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {template.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Severity
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) =>
                      setFormData({ ...formData, severity: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rule Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                  >
                    <option value="threshold">Threshold</option>
                    <option value="availability">Availability</option>
                    <option value="anomaly">Anomaly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Target */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Target
              </label>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={formData.target.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target: { ...formData.target, type: e.target.value as any },
                    })
                  }
                  className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                >
                  <option value="service">Service</option>
                  <option value="database">Database</option>
                  <option value="api_endpoint">API Endpoint</option>
                  <option value="metric">Metric</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="text"
                  value={formData.target.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target: { ...formData.target, name: e.target.value },
                    })
                  }
                  placeholder="Target name or pattern"
                  className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Conditions
                </label>
                <Button type="button" size="sm" onClick={addCondition}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Condition
                </Button>
              </div>
              <div className="space-y-3">
                {formData.conditions.map((condition, index) => (
                  <div
                    key={condition.id}
                    className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg"
                  >
                    <select
                      value={condition.type}
                      onChange={(e) =>
                        updateCondition(index, { type: e.target.value as any })
                      }
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                    >
                      <option value="metric">Metric</option>
                      <option value="status">Status</option>
                      <option value="error_rate">Error Rate</option>
                      <option value="response_time">Response Time</option>
                      <option value="custom">Custom</option>
                    </select>
                    <select
                      value={condition.operator}
                      onChange={(e) =>
                        updateCondition(index, { operator: e.target.value as any })
                      }
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                    >
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                      <option value="gte">&gt;=</option>
                      <option value="lte">&lt;=</option>
                      <option value="eq">=</option>
                      <option value="neq">!=</option>
                    </select>
                    <input
                      type="text"
                      value={String(condition.value)}
                      onChange={(e) =>
                        updateCondition(index, { value: e.target.value })
                      }
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm flex-1"
                      placeholder="Value"
                    />
                    <input
                      type="number"
                      value={condition.duration || ""}
                      onChange={(e) =>
                        updateCondition(index, {
                          duration: parseInt(e.target.value) || undefined,
                        })
                      }
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm w-20"
                      placeholder="Duration"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Actions
                </label>
                <Button type="button" size="sm" onClick={addAction}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Action
                </Button>
              </div>
              <div className="space-y-3">
                {formData.actions.map((action, index) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg"
                  >
                    <input
                      type="checkbox"
                      checked={action.enabled}
                      onChange={(e) =>
                        updateAction(index, { enabled: e.target.checked })
                      }
                      className="rounded border-gray-700"
                    />
                    <select
                      value={action.type}
                      onChange={(e) =>
                        updateAction(index, { type: e.target.value as any })
                      }
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="slack">Slack</option>
                      <option value="webhook">Webhook</option>
                      <option value="pagerduty">PagerDuty</option>
                      <option value="discord">Discord</option>
                    </select>
                    <input
                      type="text"
                      value={action.config.to || action.config.channel || action.config.url || ""}
                      onChange={(e) =>
                        updateAction(index, {
                          config: {
                            ...action.config,
                            [action.type === "email" ? "to" : 
                             action.type === "slack" ? "channel" : "url"]: e.target.value,
                          },
                        })
                      }
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm flex-1"
                      placeholder={
                        action.type === "email"
                          ? "Email address"
                          : action.type === "slack"
                          ? "Channel name"
                          : "Webhook URL"
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(index)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cooldown */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Cooldown Period (minutes)
              </label>
              <input
                type="number"
                value={formData.cooldown}
                onChange={(e) =>
                  setFormData({ ...formData, cooldown: parseInt(e.target.value) || 0 })
                }
                className="w-32 px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none"
                min="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Minimum time between alert triggers
              </p>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Rule"
                  : "Create Rule"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}