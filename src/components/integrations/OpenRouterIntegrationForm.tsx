"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Brain,
  Key,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Shield,
  Sparkles,
  Activity,
  Settings,
  TestTube,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  DollarSign,
  Zap,
  MessageSquare,
  Send,
  Terminal,
  TrendingUp,
  Clock,
  Filter,
} from "lucide-react";

interface OpenRouterIntegrationFormProps {
  applicationId: string;
  existingConfig?: {
    apiKey?: string;
    enabled: boolean;
    defaultModel?: string;
    features?: {
      streaming: boolean;
      functionCalling: boolean;
      visionModels: boolean;
      codeModels: boolean;
      customRouting: boolean;
      fallbackModels: boolean;
    };
    settings?: {
      maxTokens: number;
      temperature: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
      timeout: number;
      retries: number;
    };
    modelPreferences?: {
      preferredModels: string[];
      blockedModels: string[];
      maxCostPerRequest: number;
      preferFastModels: boolean;
    };
    usage?: {
      creditsUsed: number;
      creditsLimit: number;
      requestsToday: number;
      tokensToday: number;
    };
  };
  onSave: (config: any) => void;
  onCancel: () => void;
}

interface ValidationResult {
  isValid: boolean;
  credits?: {
    balance: number;
    limit: number;
    used: number;
  };
  models?: Array<{
    id: string;
    name: string;
    pricing: {
      prompt: number;
      completion: number;
    };
    context_length: number;
    capabilities?: string[];
  }>;
  error?: string;
}

export function OpenRouterIntegrationForm({
  applicationId,
  existingConfig,
  onSave,
  onCancel,
}: OpenRouterIntegrationFormProps) {
  const [config, setConfig] = useState({
    apiKey: existingConfig?.apiKey || '',
    enabled: existingConfig?.enabled || false,
    defaultModel: existingConfig?.defaultModel || 'openai/gpt-4-turbo-preview',
    features: existingConfig?.features || {
      streaming: true,
      functionCalling: true,
      visionModels: false,
      codeModels: true,
      customRouting: false,
      fallbackModels: true,
    },
    settings: existingConfig?.settings || {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      timeout: 30000,
      retries: 3,
    },
    modelPreferences: existingConfig?.modelPreferences || {
      preferredModels: [],
      blockedModels: [],
      maxCostPerRequest: 0.50,
      preferFastModels: false,
    },
    usage: existingConfig?.usage || {
      creditsUsed: 0,
      creditsLimit: 100,
      requestsToday: 0,
      tokensToday: 0,
    },
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testResponse, setTestResponse] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(existingConfig?.defaultModel || '');
  const [modelFilter, setModelFilter] = useState<'all' | 'fast' | 'quality' | 'vision' | 'code'>('all');

  const validateApiKey = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/integrations/openrouter/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          applicationId,
        }),
      });

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid && result.models) {
        setAvailableModels(result.models);
        if (!config.defaultModel && result.models.length > 0) {
          setConfig(prev => ({ ...prev, defaultModel: result.models[0].id }));
          setSelectedModel(result.models[0].id);
        }
        
        // Update usage information
        if (result.credits) {
          setConfig(prev => ({
            ...prev,
            usage: {
              ...prev.usage,
              creditsUsed: result.credits.used,
              creditsLimit: result.credits.limit,
            },
          }));
        }
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: 'Failed to validate API key',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const testCompletion = async () => {
    if (!config.apiKey || !selectedModel) return;

    setTestStatus('testing');
    setTestResponse('');

    try {
      const response = await fetch('/api/integrations/openrouter/test-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          model: selectedModel || config.defaultModel,
          prompt: "Explain in one sentence what OpenRouter is.",
          settings: {
            maxTokens: 100,
            temperature: config.settings.temperature,
          },
          applicationId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTestResponse(result.completion);
        setTestStatus('success');
      } else {
        setTestStatus('failed');
      }
    } catch (error) {
      setTestStatus('failed');
    }
  };

  const handleSave = () => {
    if (!validationResult?.isValid) {
      alert('Please validate your API key first');
      return;
    }

    onSave({
      provider: 'openrouter',
      config: {
        defaultModel: config.defaultModel,
        features: config.features,
        settings: config.settings,
        modelPreferences: config.modelPreferences,
        usage: config.usage,
      },
      secrets: {
        OPENROUTER_API_KEY: config.apiKey,
        OPENROUTER_DEFAULT_MODEL: config.defaultModel,
      },
      enabled: config.enabled,
    });
  };

  const getUsagePercentage = () => {
    if (!config.usage.creditsLimit) return 0;
    return (config.usage.creditsUsed / config.usage.creditsLimit) * 100;
  };

  const getFilteredModels = () => {
    if (!availableModels) return [];
    
    switch (modelFilter) {
      case 'fast':
        return availableModels.filter(m => 
          m.pricing.prompt < 0.001 || m.name.toLowerCase().includes('turbo')
        );
      case 'quality':
        return availableModels.filter(m => 
          m.name.toLowerCase().includes('gpt-4') || 
          m.name.toLowerCase().includes('claude') ||
          m.pricing.prompt > 0.01
        );
      case 'vision':
        return availableModels.filter(m => 
          m.capabilities?.includes('vision') || m.name.toLowerCase().includes('vision')
        );
      case 'code':
        return availableModels.filter(m => 
          m.capabilities?.includes('code') || 
          m.name.toLowerCase().includes('code') ||
          m.name.toLowerCase().includes('codestral')
        );
      default:
        return availableModels;
    }
  };

  const estimateCost = (model: any) => {
    if (!model?.pricing) return 'N/A';
    const promptCost = (1000 * model.pricing.prompt).toFixed(4);
    const completionCost = (1000 * model.pricing.completion).toFixed(4);
    return `$${promptCost}/$${completionCost} per 1K tokens`;
  };

  const getExampleCode = () => {
    return `import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.YOUR_SITE_URL,
    "X-Title": process.env.YOUR_APP_NAME,
  }
});

// Generate completion
const completion = await openai.chat.completions.create({
  model: "${config.defaultModel}",
  messages: [
    { role: "user", content: "Hello!" }
  ],
  max_tokens: ${config.settings.maxTokens},
  temperature: ${config.settings.temperature},
  stream: ${config.features.streaming},
});

console.log(completion.choices[0].message.content);`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-950/20 rounded-lg">
            <Brain className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">OpenRouter Integration</h2>
            <p className="text-sm text-gray-400">Unified API for multiple AI models</p>
          </div>
        </div>
        {validationResult?.credits && (
          <Badge variant={getUsagePercentage() > 90 ? 'error' : 'default'}>
            ${validationResult.credits.balance.toFixed(2)} Credits
          </Badge>
        )}
      </div>

      {/* API Key Configuration */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Configuration
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              API Key *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg pr-10"
                  placeholder="sk-or-v1-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-200"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={validateApiKey}
                disabled={!config.apiKey || isValidating}
                variant="outline"
              >
                {isValidating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Validate
              </Button>
            </div>
            
            {validationResult && (
              <div className={`mt-2 flex items-center gap-2 text-sm ${
                validationResult.isValid ? 'text-green-500' : 'text-red-500'
              }`}>
                {validationResult.isValid ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Valid API key - {validationResult.models?.length} models available
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    {validationResult.error}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Model Selection */}
          {validationResult?.isValid && availableModels.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Default Model</label>
                <div className="flex gap-1">
                  {['all', 'fast', 'quality', 'vision', 'code'].map((filter) => (
                    <Button
                      key={filter}
                      size="sm"
                      variant={modelFilter === filter ? 'default' : 'ghost'}
                      onClick={() => setModelFilter(filter as any)}
                      className="text-xs"
                    >
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              <select
                value={selectedModel || config.defaultModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setConfig(prev => ({ ...prev, defaultModel: e.target.value }));
                }}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              >
                {getFilteredModels().map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {estimateCost(model)}
                  </option>
                ))}
              </select>
              {selectedModel && (
                <div className="mt-2 text-xs text-gray-400">
                  Context: {availableModels.find(m => m.id === selectedModel)?.context_length?.toLocaleString()} tokens
                </div>
              )}
            </div>
          )}

          {/* Test Completion */}
          {validationResult?.isValid && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Test Completion</p>
                  <p className="text-xs text-gray-400">Generate a test response with selected model</p>
                </div>
                <Button
                  size="sm"
                  onClick={testCompletion}
                  disabled={testStatus === 'testing'}
                  variant={testStatus === 'success' ? 'default' : 'outline'}
                >
                  {testStatus === 'testing' ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : testStatus === 'success' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Test Successful
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Test Model
                    </>
                  )}
                </Button>
              </div>
              
              {testResponse && (
                <div className="p-3 bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-300">{testResponse}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Usage & Credits */}
      {validationResult?.isValid && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Usage & Credits
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Credit Usage</span>
                <span className="text-sm">
                  ${config.usage.creditsUsed.toFixed(2)} / ${config.usage.creditsLimit.toFixed(2)}
                </span>
              </div>
              <Progress value={getUsagePercentage()} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">
                ${(config.usage.creditsLimit - config.usage.creditsUsed).toFixed(2)} credits remaining
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Requests Today</p>
                <p className="text-2xl font-bold">
                  {config.usage.requestsToday.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Tokens Today</p>
                <p className="text-2xl font-bold">
                  {config.usage.tokensToday.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Model Preferences */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Model Preferences
        </h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Max Cost Per Request
                <span className="ml-2 text-xs text-gray-400">(${config.modelPreferences.maxCostPerRequest})</span>
              </label>
            </div>
            <input
              type="range"
              min="0.01"
              max="5.00"
              step="0.01"
              value={config.modelPreferences.maxCostPerRequest}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                modelPreferences: { ...prev.modelPreferences, maxCostPerRequest: parseFloat(e.target.value) }
              }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Limit maximum cost per API request
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Prefer Fast Models</p>
              <p className="text-xs text-gray-400">Prioritize speed over quality</p>
            </div>
            <Switch
              checked={config.modelPreferences.preferFastModels}
              onCheckedChange={(checked) => setConfig(prev => ({
                ...prev,
                modelPreferences: { ...prev.modelPreferences, preferFastModels: checked }
              }))}
            />
          </div>
        </div>
      </Card>

      {/* Generation Settings */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Generation Settings
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Max Tokens</label>
              <input
                type="number"
                min="1"
                max="32768"
                value={config.settings.maxTokens}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, maxTokens: parseInt(e.target.value) }
                }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Timeout (ms)</label>
              <input
                type="number"
                min="5000"
                max="120000"
                value={config.settings.timeout}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, timeout: parseInt(e.target.value) }
                }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Temperature
                <span className="ml-2 text-xs text-gray-400">({config.settings.temperature})</span>
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.settings.temperature}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                settings: { ...prev.settings, temperature: parseFloat(e.target.value) }
              }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lower = more focused, Higher = more creative
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Top P
                <span className="ml-2 text-xs text-gray-400">({config.settings.topP})</span>
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.settings.topP}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                settings: { ...prev.settings, topP: parseFloat(e.target.value) }
              }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nucleus sampling parameter
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Frequency Penalty
                  <span className="ml-2 text-xs text-gray-400">({config.settings.frequencyPenalty})</span>
                </label>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={config.settings.frequencyPenalty}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, frequencyPenalty: parseFloat(e.target.value) }
                }))}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Presence Penalty
                  <span className="ml-2 text-xs text-gray-400">({config.settings.presencePenalty})</span>
                </label>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={config.settings.presencePenalty}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, presencePenalty: parseFloat(e.target.value) }
                }))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Features */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Features
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(config.features).map(([feature, enabled]) => (
            <div key={feature} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {feature === 'streaming' && 'Streaming Responses'}
                  {feature === 'functionCalling' && 'Function Calling'}
                  {feature === 'visionModels' && 'Vision Models'}
                  {feature === 'codeModels' && 'Code Generation'}
                  {feature === 'customRouting' && 'Custom Routing'}
                  {feature === 'fallbackModels' && 'Fallback Models'}
                </p>
                <p className="text-xs text-gray-400">
                  {feature === 'streaming' && 'Real-time token streaming'}
                  {feature === 'functionCalling' && 'Tool and function support'}
                  {feature === 'visionModels' && 'Image understanding models'}
                  {feature === 'codeModels' && 'Specialized code models'}
                  {feature === 'customRouting' && 'Advanced routing logic'}
                  {feature === 'fallbackModels' && 'Automatic failover'}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  features: { ...prev.features, [feature]: checked }
                }))}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Example Code */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Quick Start Code
        </h3>
        
        <div className="relative">
          <pre className="p-4 bg-gray-900 rounded-lg text-sm overflow-x-auto">
            <code>{getExampleCode()}</code>
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2"
            onClick={() => navigator.clipboard.writeText(getExampleCode())}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <a
            href="https://openrouter.ai/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            View Documentation
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://openrouter.ai/activity"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            Open OpenRouter Dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
          />
          <label className="text-sm font-medium">
            Enable OpenRouter Integration
          </label>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!validationResult?.isValid || !config.enabled}
          >
            <Shield className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}