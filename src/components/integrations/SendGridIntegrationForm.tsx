"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Mail,
  Key,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Shield,
  Send,
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
  BarChart3,
  Users,
  MessageSquare,
  Terminal,
  Calendar,
  TrendingUp,
  Globe,
  User,
} from "lucide-react";

interface SendGridIntegrationFormProps {
  applicationId: string;
  existingConfig?: {
    apiKey?: string;
    enabled: boolean;
    fromEmail?: string;
    fromName?: string;
    replyToEmail?: string;
    features?: {
      transactional: boolean;
      marketing: boolean;
      templates: boolean;
      webhooks: boolean;
      analytics: boolean;
      suppressions: boolean;
    };
    settings?: {
      trackOpens: boolean;
      trackClicks: boolean;
      subscriptionTracking: boolean;
      googleAnalytics: boolean;
      retryOnFailure: boolean;
      maxRetries: number;
    };
    templates?: Array<{
      id: string;
      name: string;
      subject: string;
      type: 'transactional' | 'marketing';
    }>;
    stats?: {
      emailsSent: number;
      delivered: number;
      opens: number;
      clicks: number;
      bounces: number;
      reputation: number;
    };
  };
  onSave: (config: any) => void;
  onCancel: () => void;
}

interface ValidationResult {
  isValid: boolean;
  user?: {
    username: string;
    email: string;
    reputation: number;
  };
  stats?: {
    blocks: number;
    bounce_drops: number;
    bounces: number;
    clicks: number;
    deferred: number;
    delivered: number;
    invalid_emails: number;
    opens: number;
    processed: number;
    requests: number;
    spam_report_drops: number;
    spam_reports: number;
    unique_clicks: number;
    unique_opens: number;
    unsubscribe_drops: number;
    unsubscribes: number;
  };
  templates?: Array<{
    id: string;
    name: string;
    subject: string;
    updated_at: string;
    generation: string;
  }>;
  error?: string;
}

export function SendGridIntegrationForm({
  applicationId,
  existingConfig,
  onSave,
  onCancel,
}: SendGridIntegrationFormProps) {
  const [config, setConfig] = useState({
    apiKey: existingConfig?.apiKey || '',
    enabled: existingConfig?.enabled || false,
    fromEmail: existingConfig?.fromEmail || '',
    fromName: existingConfig?.fromName || '',
    replyToEmail: existingConfig?.replyToEmail || '',
    features: existingConfig?.features || {
      transactional: true,
      marketing: false,
      templates: true,
      webhooks: false,
      analytics: true,
      suppressions: true,
    },
    settings: existingConfig?.settings || {
      trackOpens: true,
      trackClicks: true,
      subscriptionTracking: false,
      googleAnalytics: false,
      retryOnFailure: true,
      maxRetries: 3,
    },
    templates: existingConfig?.templates || [],
    stats: existingConfig?.stats || {
      emailsSent: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
      bounces: 0,
      reputation: 0,
    },
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle');
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const validateApiKey = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/integrations/sendgrid/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          applicationId,
        }),
      });

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        if (result.templates) {
          setAvailableTemplates(result.templates);
        }
        
        // Update stats if available
        if (result.stats) {
          setConfig(prev => ({
            ...prev,
            stats: {
              emailsSent: result.stats.processed || 0,
              delivered: result.stats.delivered || 0,
              opens: result.stats.opens || 0,
              clicks: result.stats.clicks || 0,
              bounces: result.stats.bounces || 0,
              reputation: result.user?.reputation || 0,
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

  const sendTestEmail = async () => {
    if (!config.apiKey || !testEmailAddress) return;

    setTestEmailStatus('sending');

    try {
      const response = await fetch('/api/integrations/sendgrid/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          toEmail: testEmailAddress,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          subject: 'SendGrid Integration Test',
          content: 'This is a test email from your GMAC.IO Control Panel SendGrid integration.',
          settings: config.settings,
          applicationId,
        }),
      });

      if (response.ok) {
        setTestEmailStatus('success');
      } else {
        setTestEmailStatus('failed');
      }
    } catch (error) {
      setTestEmailStatus('failed');
    }
  };

  const handleSave = () => {
    if (!validationResult?.isValid) {
      alert('Please validate your API key first');
      return;
    }

    if (!config.fromEmail) {
      alert('From email address is required');
      return;
    }

    onSave({
      provider: 'sendgrid',
      config: {
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyToEmail: config.replyToEmail,
        features: config.features,
        settings: config.settings,
        templates: config.templates,
        stats: config.stats,
      },
      secrets: {
        SENDGRID_API_KEY: config.apiKey,
        SENDGRID_FROM_EMAIL: config.fromEmail,
        SENDGRID_FROM_NAME: config.fromName,
      },
      enabled: config.enabled,
    });
  };

  const getDeliveryRate = () => {
    if (!config.stats.emailsSent) return 0;
    return (config.stats.delivered / config.stats.emailsSent) * 100;
  };

  const getOpenRate = () => {
    if (!config.stats.delivered) return 0;
    return (config.stats.opens / config.stats.delivered) * 100;
  };

  const getClickRate = () => {
    if (!config.stats.delivered) return 0;
    return (config.stats.clicks / config.stats.delivered) * 100;
  };

  const getExampleCode = () => {
    return `import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'recipient@example.com',
  from: {
    email: '${config.fromEmail}',
    name: '${config.fromName}',
  },
  subject: 'Hello from SendGrid',
  text: 'Hello, this is a test email!',
  html: '<h1>Hello, this is a test email!</h1>',
  ${config.settings.trackOpens ? 'trackingSettings: {\n    openTracking: { enable: true },\n  },' : ''}
  ${config.settings.trackClicks ? 'clickTracking: { enable: true },' : ''}
  ${config.replyToEmail ? `replyTo: '${config.replyToEmail}',` : ''}
};

try {
  await sgMail.send(msg);
  console.log('Email sent successfully');
} catch (error) {
  console.error('Error sending email:', error);
}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-950/20 rounded-lg">
            <Mail className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">SendGrid Integration</h2>
            <p className="text-sm text-gray-400">Email delivery and marketing platform</p>
          </div>
        </div>
        {validationResult?.user && (
          <Badge variant={validationResult.user.reputation > 80 ? 'default' : 'secondary'}>
            Reputation: {validationResult.user.reputation}%
          </Badge>
        )}
      </div>

      {/* API Configuration */}
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
                  placeholder="SG...."
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
                    Valid API key - Connected as {validationResult.user?.username}
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

          {/* Sender Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                From Email *
              </label>
              <input
                type="email"
                value={config.fromEmail}
                onChange={(e) => setConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                placeholder="noreply@yourdomain.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                From Name
              </label>
              <input
                type="text"
                value={config.fromName}
                onChange={(e) => setConfig(prev => ({ ...prev, fromName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                placeholder="Your App Name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Reply-To Email
            </label>
            <input
              type="email"
              value={config.replyToEmail}
              onChange={(e) => setConfig(prev => ({ ...prev, replyToEmail: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              placeholder="support@yourdomain.com"
            />
          </div>

          {/* Test Email */}
          {validationResult?.isValid && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Send Test Email</p>
                  <p className="text-xs text-gray-400">Test your configuration with a real email</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                  placeholder="test@example.com"
                />
                <Button
                  onClick={sendTestEmail}
                  disabled={testEmailStatus === 'sending' || !testEmailAddress || !config.fromEmail}
                  variant={testEmailStatus === 'success' ? 'default' : 'outline'}
                >
                  {testEmailStatus === 'sending' ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : testEmailStatus === 'success' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Sent
                    </>
                  ) : testEmailStatus === 'failed' ? (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Failed
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Email Statistics */}
      {validationResult?.isValid && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Email Statistics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{config.stats.emailsSent.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Emails Sent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{getDeliveryRate().toFixed(1)}%</p>
              <p className="text-sm text-gray-400">Delivery Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-500">{getOpenRate().toFixed(1)}%</p>
              <p className="text-sm text-gray-400">Open Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-500">{getClickRate().toFixed(1)}%</p>
              <p className="text-sm text-gray-400">Click Rate</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Delivery Rate</span>
                <span>{getDeliveryRate().toFixed(1)}%</span>
              </div>
              <Progress value={getDeliveryRate()} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Open Rate</span>
                <span>{getOpenRate().toFixed(1)}%</span>
              </div>
              <Progress value={getOpenRate()} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Click Rate</span>
                <span>{getClickRate().toFixed(1)}%</span>
              </div>
              <Progress value={getClickRate()} className="h-2" />
            </div>
          </div>
        </Card>
      )}

      {/* Email Settings */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Email Settings
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Track Opens</p>
                <p className="text-xs text-gray-400">Track when emails are opened</p>
              </div>
              <Switch
                checked={config.settings.trackOpens}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, trackOpens: checked }
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Track Clicks</p>
                <p className="text-xs text-gray-400">Track link clicks in emails</p>
              </div>
              <Switch
                checked={config.settings.trackClicks}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, trackClicks: checked }
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Subscription Tracking</p>
                <p className="text-xs text-gray-400">Add unsubscribe links</p>
              </div>
              <Switch
                checked={config.settings.subscriptionTracking}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, subscriptionTracking: checked }
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Google Analytics</p>
                <p className="text-xs text-gray-400">Enable GA tracking</p>
              </div>
              <Switch
                checked={config.settings.googleAnalytics}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, googleAnalytics: checked }
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Retry on Failure</p>
                <p className="text-xs text-gray-400">Automatic retry failed emails</p>
              </div>
              <Switch
                checked={config.settings.retryOnFailure}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, retryOnFailure: checked }
                }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Max Retries</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.settings.maxRetries}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, maxRetries: parseInt(e.target.value) }
                }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                disabled={!config.settings.retryOnFailure}
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
                  {feature === 'transactional' && 'Transactional Emails'}
                  {feature === 'marketing' && 'Marketing Campaigns'}
                  {feature === 'templates' && 'Email Templates'}
                  {feature === 'webhooks' && 'Event Webhooks'}
                  {feature === 'analytics' && 'Email Analytics'}
                  {feature === 'suppressions' && 'Suppression Management'}
                </p>
                <p className="text-xs text-gray-400">
                  {feature === 'transactional' && 'Password resets, receipts, notifications'}
                  {feature === 'marketing' && 'Newsletters, promotional campaigns'}
                  {feature === 'templates' && 'Reusable email templates'}
                  {feature === 'webhooks' && 'Real-time event notifications'}
                  {feature === 'analytics' && 'Detailed email performance metrics'}
                  {feature === 'suppressions' && 'Bounce and unsubscribe handling'}
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

      {/* Templates */}
      {validationResult?.isValid && availableTemplates.length > 0 && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Email Templates
          </h3>
          
          <div className="space-y-2">
            {availableTemplates.slice(0, 5).map((template) => (
              <div key={template.id} className="p-3 bg-gray-900 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-gray-400">{template.subject}</p>
                </div>
                <Badge variant="outline">{template.generation}</Badge>
              </div>
            ))}
            {availableTemplates.length > 5 && (
              <p className="text-sm text-gray-400 text-center">
                +{availableTemplates.length - 5} more templates
              </p>
            )}
          </div>
        </Card>
      )}

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
            href="https://docs.sendgrid.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            View Documentation
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://app.sendgrid.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            Open SendGrid Dashboard
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
            Enable SendGrid Integration
          </label>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!validationResult?.isValid || !config.enabled || !config.fromEmail}
          >
            <Shield className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}