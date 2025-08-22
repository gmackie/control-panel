"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import { INTEGRATION_TEMPLATES } from "@/types/applications";

interface AddIntegrationModalProps {
  applicationId: string;
  provider: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddIntegrationModal({ 
  applicationId, 
  provider, 
  onClose, 
  onSuccess 
}: AddIntegrationModalProps) {
  const queryClient = useQueryClient();
  const integration = INTEGRATION_TEMPLATES[provider as keyof typeof INTEGRATION_TEMPLATES];
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'configure' | 'verify' | 'complete'>('configure');

  const addIntegrationMutation = useMutation({
    mutationFn: async () => {
      // First, create the secrets
      const secretPromises = Object.entries(secrets).map(([key, value]) =>
        fetch(`/api/applications/${applicationId}/secrets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            value,
            category: integration.requiredSecrets.find(s => s.key === key)?.category ||
                     ('optionalSecrets' in integration ? integration.optionalSecrets?.find(s => s.key === key)?.category : undefined) ||
                     'api',
            provider: integration.provider,
            description: integration.requiredSecrets.find(s => s.key === key)?.description ||
                        ('optionalSecrets' in integration ? integration.optionalSecrets?.find(s => s.key === key)?.description : undefined),
          }),
        })
      );

      await Promise.all(secretPromises);

      // Then create the integration
      const response = await fetch(`/api/applications/${applicationId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: integration.provider,
          name: integration.name,
          enabled: true,
          config: {},
          secrets: Object.keys(secrets),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add integration");
      }

      return response.json();
    },
    onSuccess: () => {
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["secrets", applicationId] });
      setTimeout(onSuccess, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('verify');
    addIntegrationMutation.mutate();
  };

  const allRequiredSecrets = integration.requiredSecrets.every(
    secret => secrets[secret.key]
  );

  if (!integration) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{integration.icon}</span>
              <div>
                <h2 className="text-xl font-semibold">Connect {integration.name}</h2>
                <p className="text-sm text-gray-400">{integration.description}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {step === 'configure' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Required Configuration</h3>
                <div className="space-y-4">
                  {integration.requiredSecrets.map((secret) => (
                    <div key={secret.key}>
                      <label className="block text-sm font-medium mb-2">
                        {secret.key} *
                      </label>
                      <input
                        type="text"
                        value={secrets[secret.key] || ''}
                        onChange={(e) => setSecrets({ ...secrets, [secret.key]: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none font-mono text-sm"
                        placeholder={`Enter ${secret.key}`}
                        required
                      />
                      {secret.description && (
                        <p className="text-xs text-gray-400 mt-1">{secret.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {'optionalSecrets' in integration && integration.optionalSecrets && integration.optionalSecrets.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Optional Configuration</h3>
                  <div className="space-y-4">
                    {integration.optionalSecrets.map((secret) => (
                      <div key={secret.key}>
                        <label className="block text-sm font-medium mb-2">
                          {secret.key}
                        </label>
                        <input
                          type="text"
                          value={secrets[secret.key] || ''}
                          onChange={(e) => setSecrets({ ...secrets, [secret.key]: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md focus:border-blue-500 focus:outline-none font-mono text-sm"
                          placeholder={`Enter ${secret.key} (optional)`}
                        />
                        {secret.description && (
                          <p className="text-xs text-gray-400 mt-1">{secret.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-3">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {integration.features.map((feature) => (
                    <Badge key={feature} variant="outline">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!allRequiredSecrets}>
                  Connect {integration.name}
                </Button>
              </div>
            </form>
          )}

          {step === 'verify' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Connecting to {integration.name}</h3>
              <p className="text-gray-400">Verifying credentials and setting up integration...</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Successfully Connected!</h3>
              <p className="text-gray-400">
                {integration.name} has been connected to your application.
              </p>
            </div>
          )}

          {addIntegrationMutation.error && (
            <div className="mt-4 p-3 bg-red-950/20 border border-red-900 rounded-md">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                {addIntegrationMutation.error.message}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}