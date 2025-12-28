"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Eye,
  EyeOff,
  TestTube,
} from "lucide-react";
import { INTEGRATION_TEMPLATES } from "@/types/applications";

interface GenericIntegrationFormProps {
  applicationId: string;
  provider: string;
  existingConfig?: {
    id?: string;
    enabled?: boolean;
    config?: Record<string, any>;
  };
  onSave: (config: any) => void;
  onCancel: () => void;
}

export function GenericIntegrationForm({
  applicationId,
  provider,
  existingConfig,
  onSave,
  onCancel,
}: GenericIntegrationFormProps) {
  const template = INTEGRATION_TEMPLATES[provider as keyof typeof INTEGRATION_TEMPLATES];
  
  if (!template) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Unknown Integration</h3>
          <p className="text-gray-400">
            No template found for provider: {provider}
          </p>
          <Button onClick={onCancel} className="mt-4">
            Go Back
          </Button>
        </div>
      </Card>
    );
  }

  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [enabled, setEnabled] = useState(existingConfig?.enabled ?? true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      // Test the connection by calling a validation endpoint
      const response = await fetch(`/api/integrations/${provider}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secrets }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Validation failed");
      }
      
      return response.json();
    },
    onMutate: () => {
      setTestStatus('testing');
      setTestMessage('');
    },
    onSuccess: (data) => {
      setTestStatus('success');
      setTestMessage(data.message || 'Connection successful!');
    },
    onError: (error: Error) => {
      setTestStatus('error');
      setTestMessage(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      provider: template.provider,
      name: template.name,
      enabled,
      config: {
        ...existingConfig?.config,
      },
      secrets: Object.keys(secrets).filter(k => secrets[k]),
      // The secrets will be stored separately via the secrets API
      secretValues: secrets,
    });
  };

  const allRequiredFilled = template.requiredSecrets.every(
    secret => secrets[secret.key]?.trim()
  );

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{template.icon}</span>
          <div>
            <h2 className="text-xl font-semibold">
              {existingConfig?.id ? 'Configure' : 'Connect'} {template.name}
            </h2>
            <p className="text-sm text-gray-400">{template.description}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Required Secrets */}
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            Required Configuration
            <Badge variant="outline" className="text-xs">Required</Badge>
          </h3>
          <div className="space-y-4">
            {template.requiredSecrets.map((secret) => (
              <div key={secret.key}>
                <Label htmlFor={secret.key} className="flex items-center gap-2 mb-2">
                  {secret.key}
                  <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id={secret.key}
                    type={showSecrets[secret.key] ? "text" : "password"}
                    value={secrets[secret.key] || ''}
                    onChange={(e) => setSecrets({ ...secrets, [secret.key]: e.target.value })}
                    placeholder={`Enter ${secret.key}`}
                    className="font-mono pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => toggleShowSecret(secret.key)}
                  >
                    {showSecrets[secret.key] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {secret.description && (
                  <p className="text-xs text-gray-400 mt-1">{secret.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Optional Secrets */}
        {'optionalSecrets' in template && template.optionalSecrets && template.optionalSecrets.length > 0 && (
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              Optional Configuration
              <Badge variant="secondary" className="text-xs">Optional</Badge>
            </h3>
            <div className="space-y-4">
              {template.optionalSecrets.map((secret) => (
                <div key={secret.key}>
                  <Label htmlFor={secret.key} className="block mb-2">
                    {secret.key}
                  </Label>
                  <div className="relative">
                    <Input
                      id={secret.key}
                      type={showSecrets[secret.key] ? "text" : "password"}
                      value={secrets[secret.key] || ''}
                      onChange={(e) => setSecrets({ ...secrets, [secret.key]: e.target.value })}
                      placeholder={`Enter ${secret.key} (optional)`}
                      className="font-mono pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => toggleShowSecret(secret.key)}
                    >
                      {showSecrets[secret.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {secret.description && (
                    <p className="text-xs text-gray-400 mt-1">{secret.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        <div>
          <h3 className="font-medium mb-3">Features</h3>
          <div className="flex flex-wrap gap-2">
            {template.features.map((feature) => (
              <Badge key={feature} variant="outline">
                {feature}
              </Badge>
            ))}
          </div>
        </div>

        {/* Test Connection */}
        {allRequiredFilled && (
          <div className="border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Test Connection</h3>
                <p className="text-sm text-gray-400">
                  Verify your credentials before saving
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testConnectionMutation.mutate()}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
            {testStatus !== 'idle' && testStatus !== 'testing' && (
              <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                testStatus === 'success' 
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {testStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="text-sm">{testMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between border border-gray-800 rounded-lg p-4">
          <div>
            <h3 className="font-medium">Enable Integration</h3>
            <p className="text-sm text-gray-400">
              When disabled, this integration will not be active
            </p>
          </div>
          <Button
            type="button"
            variant={enabled ? "default" : "outline"}
            size="sm"
            onClick={() => setEnabled(!enabled)}
          >
            {enabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!allRequiredFilled}>
            {existingConfig?.id ? 'Update Integration' : 'Connect Integration'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
