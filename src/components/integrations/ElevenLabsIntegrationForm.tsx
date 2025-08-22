"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Mic,
  Key,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Shield,
  Volume2,
  Settings,
  TestTube,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  DollarSign,
  Zap,
  User,
  Play,
  Download,
  Terminal,
} from "lucide-react";

interface ElevenLabsIntegrationFormProps {
  applicationId: string;
  existingConfig?: {
    apiKey?: string;
    enabled: boolean;
    defaultVoiceId?: string;
    features?: {
      textToSpeech: boolean;
      voiceCloning: boolean;
      speechToSpeech: boolean;
      audioNative: boolean;
      projects: boolean;
    };
    settings?: {
      stability: number;
      similarityBoost: number;
      style: number;
      useSpeakerBoost: boolean;
      optimizeStreamingLatency: number;
    };
    quota?: {
      charactersUsed: number;
      charactersLimit: number;
      voicesCreated: number;
      voicesLimit: number;
    };
  };
  onSave: (config: any) => void;
  onCancel: () => void;
}

interface ValidationResult {
  isValid: boolean;
  subscription?: {
    tier: string;
    charactersLimit: number;
    charactersUsed: number;
    voicesLimit: number;
    canCloneVoices: boolean;
    canUseProjects: boolean;
  };
  voices?: Array<{
    voice_id: string;
    name: string;
    category: string;
    labels?: Record<string, string>;
  }>;
  error?: string;
}

export function ElevenLabsIntegrationForm({
  applicationId,
  existingConfig,
  onSave,
  onCancel,
}: ElevenLabsIntegrationFormProps) {
  const [config, setConfig] = useState({
    apiKey: existingConfig?.apiKey || '',
    enabled: existingConfig?.enabled || false,
    defaultVoiceId: existingConfig?.defaultVoiceId || '',
    features: existingConfig?.features || {
      textToSpeech: true,
      voiceCloning: false,
      speechToSpeech: false,
      audioNative: false,
      projects: false,
    },
    settings: existingConfig?.settings || {
      stability: 50,
      similarityBoost: 75,
      style: 0,
      useSpeakerBoost: true,
      optimizeStreamingLatency: 0,
    },
    quota: existingConfig?.quota || {
      charactersUsed: 0,
      charactersLimit: 10000,
      voicesCreated: 0,
      voicesLimit: 10,
    },
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [testSpeechStatus, setTestSpeechStatus] = useState<'idle' | 'generating' | 'playing' | 'success' | 'failed'>('idle');
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  const validateApiKey = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/integrations/elevenlabs/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          applicationId,
        }),
      });

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid && result.voices) {
        setAvailableVoices(result.voices);
        if (!config.defaultVoiceId && result.voices.length > 0) {
          setConfig(prev => ({ ...prev, defaultVoiceId: result.voices[0].voice_id }));
          setSelectedVoice(result.voices[0].voice_id);
        }
        
        // Update quota information
        if (result.subscription) {
          setConfig(prev => ({
            ...prev,
            quota: {
              charactersUsed: result.subscription.charactersUsed,
              charactersLimit: result.subscription.charactersLimit,
              voicesCreated: result.voices.filter((v: any) => v.category === 'cloned').length,
              voicesLimit: result.subscription.voicesLimit,
            },
            features: {
              ...prev.features,
              voiceCloning: result.subscription.canCloneVoices,
              projects: result.subscription.canUseProjects,
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

  const testTextToSpeech = async () => {
    if (!config.apiKey || !selectedVoice) return;

    setTestSpeechStatus('generating');

    try {
      const response = await fetch('/api/integrations/elevenlabs/test-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          voiceId: selectedVoice || config.defaultVoiceId,
          text: "Hello! This is a test of the ElevenLabs text to speech integration.",
          settings: config.settings,
          applicationId,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setTestAudioUrl(url);
        
        // Play the audio
        setTestSpeechStatus('playing');
        const audio = new Audio(url);
        audio.onended = () => setTestSpeechStatus('success');
        audio.onerror = () => setTestSpeechStatus('failed');
        await audio.play();
      } else {
        setTestSpeechStatus('failed');
      }
    } catch (error) {
      setTestSpeechStatus('failed');
    }
  };

  const handleSave = () => {
    if (!validationResult?.isValid) {
      alert('Please validate your API key first');
      return;
    }

    onSave({
      provider: 'elevenlabs',
      config: {
        defaultVoiceId: config.defaultVoiceId,
        features: config.features,
        settings: config.settings,
        quota: config.quota,
      },
      secrets: {
        ELEVENLABS_API_KEY: config.apiKey,
        ELEVENLABS_VOICE_ID: config.defaultVoiceId,
      },
      enabled: config.enabled,
    });
  };

  const getUsagePercentage = () => {
    if (!config.quota.charactersLimit) return 0;
    return (config.quota.charactersUsed / config.quota.charactersLimit) * 100;
  };

  const getExampleCode = () => {
    return `import { ElevenLabsClient } from "elevenlabs";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Generate speech
const audio = await elevenlabs.generate({
  voice: process.env.ELEVENLABS_VOICE_ID,
  text: "Hello from ElevenLabs!",
  model_id: "eleven_monolingual_v1",
  voice_settings: {
    stability: ${config.settings.stability / 100},
    similarity_boost: ${config.settings.similarityBoost / 100},
    style: ${config.settings.style / 100},
    use_speaker_boost: ${config.settings.useSpeakerBoost},
  },
});

// Stream audio
const fs = require("fs");
const stream = fs.createWriteStream("output.mp3");
audio.pipe(stream);`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-950/20 rounded-lg">
            <Mic className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">ElevenLabs Integration</h2>
            <p className="text-sm text-gray-400">AI voice synthesis and text-to-speech</p>
          </div>
        </div>
        {validationResult?.subscription && (
          <Badge variant={validationResult.subscription.tier === 'free' ? 'secondary' : 'default'}>
            {validationResult.subscription.tier} Plan
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
                  placeholder="Enter your ElevenLabs API key"
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
                    Valid API key - {validationResult.voices?.length} voices available
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

          {/* Voice Selection */}
          {validationResult?.isValid && availableVoices.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Default Voice</label>
              <select
                value={selectedVoice || config.defaultVoiceId}
                onChange={(e) => {
                  setSelectedVoice(e.target.value);
                  setConfig(prev => ({ ...prev, defaultVoiceId: e.target.value }));
                }}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              >
                {availableVoices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} {voice.labels?.accent && `(${voice.labels.accent})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Test Text-to-Speech */}
          {validationResult?.isValid && (
            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium">Test Voice</p>
                <p className="text-xs text-gray-400">Generate a sample audio with selected voice</p>
              </div>
              <Button
                size="sm"
                onClick={testTextToSpeech}
                disabled={testSpeechStatus === 'generating' || testSpeechStatus === 'playing'}
                variant={testSpeechStatus === 'success' ? 'default' : 'outline'}
              >
                {testSpeechStatus === 'generating' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : testSpeechStatus === 'playing' ? (
                  <>
                    <Volume2 className="h-4 w-4 mr-2 animate-pulse" />
                    Playing...
                  </>
                ) : testSpeechStatus === 'success' ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Test Successful
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Test Voice
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Usage & Quota */}
      {validationResult?.isValid && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Usage & Quota
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Character Usage</span>
                <span className="text-sm">
                  {config.quota.charactersUsed.toLocaleString()} / {config.quota.charactersLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={getUsagePercentage()} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">
                {(config.quota.charactersLimit - config.quota.charactersUsed).toLocaleString()} characters remaining
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Voices Created</p>
                <p className="text-2xl font-bold">
                  {config.quota.voicesCreated} / {config.quota.voicesLimit}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Monthly Reset</p>
                <p className="text-2xl font-bold">
                  {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getDate()} days
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Voice Settings */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Voice Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Stability
                <span className="ml-2 text-xs text-gray-400">({config.settings.stability}%)</span>
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.settings.stability}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                settings: { ...prev.settings, stability: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lower = more variable, Higher = more consistent
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Clarity + Similarity Enhancement
                <span className="ml-2 text-xs text-gray-400">({config.settings.similarityBoost}%)</span>
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.settings.similarityBoost}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                settings: { ...prev.settings, similarityBoost: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values boost clarity but may reduce generation variability
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Style Exaggeration
                <span className="ml-2 text-xs text-gray-400">({config.settings.style}%)</span>
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.settings.style}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                settings: { ...prev.settings, style: parseInt(e.target.value) }
              }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values make the voice more expressive
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Speaker Boost</p>
              <p className="text-xs text-gray-400">Enhance audio quality</p>
            </div>
            <Switch
              checked={config.settings.useSpeakerBoost}
              onCheckedChange={(checked) => setConfig(prev => ({
                ...prev,
                settings: { ...prev.settings, useSpeakerBoost: checked }
              }))}
            />
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
                  {feature === 'textToSpeech' && 'Text to Speech'}
                  {feature === 'voiceCloning' && 'Voice Cloning'}
                  {feature === 'speechToSpeech' && 'Speech to Speech'}
                  {feature === 'audioNative' && 'Audio Native'}
                  {feature === 'projects' && 'Projects'}
                </p>
                <p className="text-xs text-gray-400">
                  {feature === 'textToSpeech' && 'Convert text to natural speech'}
                  {feature === 'voiceCloning' && 'Clone custom voices'}
                  {feature === 'speechToSpeech' && 'Voice conversion'}
                  {feature === 'audioNative' && 'Localized audio'}
                  {feature === 'projects' && 'Long-form content'}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  features: { ...prev.features, [feature]: checked }
                }))}
                disabled={
                  (feature === 'voiceCloning' && !validationResult?.subscription?.canCloneVoices) ||
                  (feature === 'projects' && !validationResult?.subscription?.canUseProjects)
                }
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
            href="https://docs.elevenlabs.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            View Documentation
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://elevenlabs.io/app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            Open ElevenLabs Dashboard
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
            Enable ElevenLabs Integration
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