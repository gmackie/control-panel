"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  Key,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Shield,
  Webhook,
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Settings,
  TestTube,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
} from "lucide-react";

interface StripeIntegrationFormProps {
  applicationId: string;
  existingConfig?: {
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
    enabled: boolean;
    mode: 'test' | 'live';
    features?: {
      payments: boolean;
      subscriptions: boolean;
      invoices: boolean;
      checkout: boolean;
      paymentLinks: boolean;
      taxCalculation: boolean;
    };
    webhooks?: {
      endpoint?: string;
      events?: string[];
    };
  };
  onSave: (config: any) => void;
  onCancel: () => void;
}

interface StripeValidationResult {
  isValid: boolean;
  mode: 'test' | 'live';
  accountName?: string;
  accountId?: string;
  features?: {
    payments: boolean;
    subscriptions: boolean;
    invoicing: boolean;
    tax: boolean;
  };
  error?: string;
}

export function StripeIntegrationForm({
  applicationId,
  existingConfig,
  onSave,
  onCancel,
}: StripeIntegrationFormProps) {
  const [config, setConfig] = useState({
    secretKey: existingConfig?.secretKey || '',
    publishableKey: existingConfig?.publishableKey || '',
    webhookSecret: existingConfig?.webhookSecret || '',
    enabled: existingConfig?.enabled || false,
    mode: existingConfig?.mode || 'test',
    features: existingConfig?.features || {
      payments: true,
      subscriptions: false,
      invoices: false,
      checkout: true,
      paymentLinks: false,
      taxCalculation: false,
    },
    webhooks: existingConfig?.webhooks || {
      endpoint: '',
      events: [],
    },
  });

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<StripeValidationResult | null>(null);
  const [testPaymentStatus, setTestPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [webhookTestStatus, setWebhookTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  const webhookEvents = [
    { id: 'payment_intent.succeeded', name: 'Payment Succeeded', category: 'payments' },
    { id: 'payment_intent.failed', name: 'Payment Failed', category: 'payments' },
    { id: 'charge.succeeded', name: 'Charge Succeeded', category: 'payments' },
    { id: 'charge.failed', name: 'Charge Failed', category: 'payments' },
    { id: 'customer.created', name: 'Customer Created', category: 'customers' },
    { id: 'customer.updated', name: 'Customer Updated', category: 'customers' },
    { id: 'customer.deleted', name: 'Customer Deleted', category: 'customers' },
    { id: 'customer.subscription.created', name: 'Subscription Created', category: 'subscriptions' },
    { id: 'customer.subscription.updated', name: 'Subscription Updated', category: 'subscriptions' },
    { id: 'customer.subscription.deleted', name: 'Subscription Canceled', category: 'subscriptions' },
    { id: 'invoice.paid', name: 'Invoice Paid', category: 'invoices' },
    { id: 'invoice.payment_failed', name: 'Invoice Payment Failed', category: 'invoices' },
    { id: 'checkout.session.completed', name: 'Checkout Completed', category: 'checkout' },
    { id: 'checkout.session.expired', name: 'Checkout Expired', category: 'checkout' },
  ];

  // Auto-generate webhook endpoint
  useEffect(() => {
    if (!config.webhooks.endpoint) {
      setConfig(prev => ({
        ...prev,
        webhooks: {
          ...prev.webhooks,
          endpoint: `https://api.gmac.io/webhooks/stripe/${applicationId}`,
        },
      }));
    }
  }, [applicationId]);

  const validateApiKey = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/integrations/stripe/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secretKey: config.secretKey,
          applicationId,
        }),
      });

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        // Auto-detect mode from key prefix
        const mode = config.secretKey.startsWith('sk_test_') ? 'test' : 'live';
        setConfig(prev => ({ ...prev, mode }));
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        mode: 'test',
        error: 'Failed to validate API key',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const testPayment = async () => {
    setTestPaymentStatus('processing');

    try {
      const response = await fetch('/api/integrations/stripe/test-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secretKey: config.secretKey,
          applicationId,
        }),
      });

      if (response.ok) {
        setTestPaymentStatus('success');
      } else {
        setTestPaymentStatus('failed');
      }
    } catch (error) {
      setTestPaymentStatus('failed');
    }
  };

  const testWebhook = async () => {
    setWebhookTestStatus('testing');

    try {
      const response = await fetch('/api/integrations/stripe/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: config.webhooks.endpoint,
          secret: config.webhookSecret,
          applicationId,
        }),
      });

      if (response.ok) {
        setWebhookTestStatus('success');
      } else {
        setWebhookTestStatus('failed');
      }
    } catch (error) {
      setWebhookTestStatus('failed');
    }
  };

  const handleSave = () => {
    if (!validationResult?.isValid) {
      alert('Please validate your API key first');
      return;
    }

    onSave({
      provider: 'stripe',
      config: {
        mode: config.mode,
        features: config.features,
        webhooks: config.webhooks,
      },
      secrets: {
        STRIPE_SECRET_KEY: config.secretKey,
        STRIPE_PUBLISHABLE_KEY: config.publishableKey,
        STRIPE_WEBHOOK_SECRET: config.webhookSecret,
      },
      enabled: config.enabled,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-950/20 rounded-lg">
            <CreditCard className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Stripe Integration</h2>
            <p className="text-sm text-gray-400">Configure payment processing with Stripe</p>
          </div>
        </div>
        <Badge variant={config.mode === 'live' ? 'error' : 'warning'}>
          {config.mode === 'live' ? 'Live Mode' : 'Test Mode'}
        </Badge>
      </div>

      {/* API Keys Configuration */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Keys
        </h3>
        
        <div className="space-y-4">
          {/* Secret Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Secret Key *
              <span className="ml-2 text-xs text-gray-400">
                {config.mode === 'test' ? '(starts with sk_test_)' : '(starts with sk_live_)'}
              </span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={config.secretKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, secretKey: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg pr-10"
                  placeholder="sk_test_..."
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-200"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={validateApiKey}
                disabled={!config.secretKey || isValidating}
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
                    Valid key for {validationResult.accountName} ({validationResult.accountId})
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

          {/* Publishable Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Publishable Key
              <span className="ml-2 text-xs text-gray-400">(for client-side)</span>
            </label>
            <input
              type="text"
              value={config.publishableKey}
              onChange={(e) => setConfig(prev => ({ ...prev, publishableKey: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              placeholder="pk_test_..."
            />
          </div>

          {/* Test Payment */}
          {validationResult?.isValid && config.mode === 'test' && (
            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium">Test Payment</p>
                <p className="text-xs text-gray-400">Create a test payment to verify setup</p>
              </div>
              <Button
                size="sm"
                onClick={testPayment}
                disabled={testPaymentStatus === 'processing'}
                variant={testPaymentStatus === 'success' ? 'default' : 'outline'}
              >
                {testPaymentStatus === 'processing' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : testPaymentStatus === 'success' ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Test Successful
                  </>
                ) : testPaymentStatus === 'failed' ? (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Test Failed
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Run Test Payment
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Features Configuration */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Features
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(config.features).map(([feature, enabled]) => (
            <div key={feature} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium capitalize">
                  {feature.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-xs text-gray-400">
                  {feature === 'payments' && 'Accept one-time payments'}
                  {feature === 'subscriptions' && 'Recurring billing'}
                  {feature === 'invoices' && 'Send and manage invoices'}
                  {feature === 'checkout' && 'Hosted checkout page'}
                  {feature === 'paymentLinks' && 'No-code payment pages'}
                  {feature === 'taxCalculation' && 'Automatic tax calculation'}
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

      {/* Webhook Configuration */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          Webhook Configuration
        </h3>
        
        <div className="space-y-4">
          {/* Webhook Endpoint */}
          <div>
            <label className="block text-sm font-medium mb-2">Webhook Endpoint</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.webhooks.endpoint}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  webhooks: { ...prev.webhooks, endpoint: e.target.value }
                }))}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                readOnly
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(config.webhooks.endpoint)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Add this URL to your Stripe webhook settings
            </p>
          </div>

          {/* Webhook Secret */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Webhook Signing Secret
              <span className="ml-2 text-xs text-gray-400">(starts with whsec_)</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={config.webhookSecret}
                  onChange={(e) => setConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg pr-10"
                  placeholder="whsec_..."
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-200"
                >
                  {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={testWebhook}
                disabled={!config.webhookSecret || webhookTestStatus === 'testing'}
                variant="outline"
                size="sm"
              >
                {webhookTestStatus === 'testing' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : webhookTestStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : webhookTestStatus === 'failed' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Test
              </Button>
            </div>
          </div>

          {/* Webhook Events */}
          <div>
            <label className="block text-sm font-medium mb-2">Subscribe to Events</label>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-3 bg-gray-900 rounded-lg">
              {webhookEvents.map((event) => (
                <label
                  key={event.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-400"
                >
                  <input
                    type="checkbox"
                    checked={config.webhooks.events?.includes(event.id) || false}
                    onChange={(e) => {
                      const events = config.webhooks.events || [];
                      if (e.target.checked) {
                        setConfig(prev => ({
                          ...prev,
                          webhooks: { ...prev.webhooks, events: [...events, event.id] }
                        }));
                      } else {
                        setConfig(prev => ({
                          ...prev,
                          webhooks: { 
                            ...prev.webhooks, 
                            events: events.filter(id => id !== event.id) 
                          }
                        }));
                      }
                    }}
                    className="rounded border-gray-600"
                  />
                  <span>{event.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {event.category}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Live Mode Warning */}
      {config.mode === 'live' && (
        <div className="p-4 bg-red-950/20 border border-red-900 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Live Mode Active</p>
              <p className="text-sm text-red-400/80 mt-1">
                You're using live API keys. Real transactions will be processed and charges will occur.
                Make sure you've thoroughly tested in test mode first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Setup Guide */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Quick Setup Guide
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-950/50 flex items-center justify-center text-xs">
              1
            </div>
            <div className="text-sm">
              <p className="font-medium">Get your API keys from Stripe</p>
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Open Stripe Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-950/50 flex items-center justify-center text-xs">
              2
            </div>
            <div className="text-sm">
              <p className="font-medium">Configure webhook endpoint</p>
              <p className="text-gray-400">Add the endpoint URL to Stripe and copy the signing secret</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-950/50 flex items-center justify-center text-xs">
              3
            </div>
            <div className="text-sm">
              <p className="font-medium">Select events to monitor</p>
              <p className="text-gray-400">Choose which Stripe events your app should handle</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-950/50 flex items-center justify-center text-xs">
              4
            </div>
            <div className="text-sm">
              <p className="font-medium">Test your integration</p>
              <p className="text-gray-400">Use test mode to verify everything works before going live</p>
            </div>
          </div>
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
            Enable Stripe Integration
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