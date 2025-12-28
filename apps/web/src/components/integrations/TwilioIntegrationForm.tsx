"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  MessageSquare,
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
  Phone,
  Terminal,
  Calendar,
  TrendingUp,
  Globe,
  User,
  Video,
  Mic,
} from "lucide-react";

interface TwilioIntegrationFormProps {
  applicationId: string;
  existingConfig?: {
    accountSid?: string;
    authToken?: string;
    enabled: boolean;
    phoneNumber?: string;
    messagingServiceSid?: string;
    features?: {
      sms: boolean;
      voice: boolean;
      whatsapp: boolean;
      video: boolean;
      verify: boolean;
      conversations: boolean;
    };
    settings?: {
      statusCallbacks: boolean;
      deliveryReceipts: boolean;
      smartEncoding: boolean;
      shortenUrls: boolean;
      maxPrice: number;
      validityPeriod: number;
    };
    phoneNumbers?: Array<{
      sid: string;
      friendlyName: string;
      phoneNumber: string;
      capabilities: {
        voice: boolean;
        SMS: boolean;
        MMS: boolean;
      };
    }>;
    stats?: {
      messagesSent: number;
      messagesDelivered: number;
      messagesFailed: number;
      callsMade: number;
      callsCompleted: number;
      totalCost: number;
    };
  };
  onSave: (config: any) => void;
  onCancel: () => void;
}

interface ValidationResult {
  isValid: boolean;
  account?: {
    accountSid: string;
    friendlyName: string;
    status: string;
    type: string;
  };
  phoneNumbers?: Array<{
    sid: string;
    friendlyName: string;
    phoneNumber: string;
    capabilities: {
      voice: boolean;
      SMS: boolean;
      MMS: boolean;
    };
  }>;
  balance?: {
    currency: string;
    balance: string;
  };
  error?: string;
}

export function TwilioIntegrationForm({
  applicationId,
  existingConfig,
  onSave,
  onCancel,
}: TwilioIntegrationFormProps) {
  const [config, setConfig] = useState({
    accountSid: existingConfig?.accountSid || '',
    authToken: existingConfig?.authToken || '',
    enabled: existingConfig?.enabled || false,
    phoneNumber: existingConfig?.phoneNumber || '',
    messagingServiceSid: existingConfig?.messagingServiceSid || '',
    features: existingConfig?.features || {
      sms: true,
      voice: false,
      whatsapp: false,
      video: false,
      verify: false,
      conversations: false,
    },
    settings: existingConfig?.settings || {
      statusCallbacks: true,
      deliveryReceipts: true,
      smartEncoding: true,
      shortenUrls: false,
      maxPrice: 0.05,
      validityPeriod: 14400, // 4 hours in seconds
    },
    phoneNumbers: existingConfig?.phoneNumbers || [],
    stats: existingConfig?.stats || {
      messagesSent: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      callsMade: 0,
      callsCompleted: 0,
      totalCost: 0,
    },
  });

  const [showAuthToken, setShowAuthToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [testMessageStatus, setTestMessageStatus] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string>('');

  const validateCredentials = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/integrations/twilio/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: config.accountSid,
          authToken: config.authToken,
          applicationId,
        }),
      });

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        if (result.phoneNumbers) {
          setAvailableNumbers(result.phoneNumbers);
          if (!config.phoneNumber && result.phoneNumbers.length > 0) {
            setConfig(prev => ({ ...prev, phoneNumber: result.phoneNumbers[0].phoneNumber }));
            setSelectedNumber(result.phoneNumbers[0].phoneNumber);
          }
        }
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: 'Failed to validate credentials',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const sendTestMessage = async () => {
    if (!config.accountSid || !config.authToken || !testPhoneNumber || !config.phoneNumber) return;

    setTestMessageStatus('sending');

    try {
      const response = await fetch('/api/integrations/twilio/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: config.accountSid,
          authToken: config.authToken,
          from: config.phoneNumber,
          to: testPhoneNumber,
          body: 'This is a test message from your GMAC.IO Control Panel Twilio integration.',
          applicationId,
        }),
      });

      if (response.ok) {
        setTestMessageStatus('success');
      } else {
        setTestMessageStatus('failed');
      }
    } catch (error) {
      setTestMessageStatus('failed');
    }
  };

  const handleSave = () => {
    if (!validationResult?.isValid) {
      alert('Please validate your credentials first');
      return;
    }

    if (!config.phoneNumber) {
      alert('Phone number is required');
      return;
    }

    onSave({
      provider: 'twilio',
      config: {
        phoneNumber: config.phoneNumber,
        messagingServiceSid: config.messagingServiceSid,
        features: config.features,
        settings: config.settings,
        phoneNumbers: config.phoneNumbers,
        stats: config.stats,
      },
      secrets: {
        TWILIO_ACCOUNT_SID: config.accountSid,
        TWILIO_AUTH_TOKEN: config.authToken,
        TWILIO_PHONE_NUMBER: config.phoneNumber,
      },
      enabled: config.enabled,
    });
  };

  const getDeliveryRate = () => {
    if (!config.stats.messagesSent) return 0;
    return (config.stats.messagesDelivered / config.stats.messagesSent) * 100;
  };

  const getSuccessRate = () => {
    if (!config.stats.callsMade) return 0;
    return (config.stats.callsCompleted / config.stats.callsMade) * 100;
  };

  const getExampleCode = () => {
    return `import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Send SMS
const message = await client.messages.create({
  body: 'Hello from Twilio!',
  from: '${config.phoneNumber}',
  to: '+1234567890',
  ${config.settings.statusCallbacks ? `statusCallback: 'https://yourapp.com/sms/status',` : ''}
  ${config.settings.maxPrice ? `maxPrice: '${config.settings.maxPrice}',` : ''}
  ${config.settings.validityPeriod !== 14400 ? `validityPeriod: ${config.settings.validityPeriod},` : ''}
});

console.log('Message SID:', message.sid);

// Make a voice call
const call = await client.calls.create({
  url: 'https://yourapp.com/voice/twiml',
  from: '${config.phoneNumber}',
  to: '+1234567890',
});

console.log('Call SID:', call.sid);`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-950/20 rounded-lg">
            <MessageSquare className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Twilio Integration</h2>
            <p className="text-sm text-gray-400">SMS, voice calls, and communication APIs</p>
          </div>
        </div>
        {validationResult?.balance && (
          <Badge variant="default">
            Balance: {validationResult.balance.currency} {validationResult.balance.balance}
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
              Account SID *
            </label>
            <input
              type="text"
              value={config.accountSid}
              onChange={(e) => setConfig(prev => ({ ...prev, accountSid: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Auth Token *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showAuthToken ? 'text' : 'password'}
                  value={config.authToken}
                  onChange={(e) => setConfig(prev => ({ ...prev, authToken: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg pr-10"
                  placeholder="Auth Token"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthToken(!showAuthToken)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-200"
                >
                  {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={validateCredentials}
                disabled={!config.accountSid || !config.authToken || isValidating}
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
                    Valid credentials - Account: {validationResult.account?.friendlyName}
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

          {/* Phone Number Selection */}
          {validationResult?.isValid && availableNumbers.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Twilio Phone Number</label>
              <select
                value={selectedNumber || config.phoneNumber}
                onChange={(e) => {
                  setSelectedNumber(e.target.value);
                  setConfig(prev => ({ ...prev, phoneNumber: e.target.value }));
                }}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              >
                {availableNumbers.map((number) => (
                  <option key={number.sid} value={number.phoneNumber}>
                    {number.phoneNumber} - {number.friendlyName}
                    {number.capabilities.SMS && ' (SMS)'}
                    {number.capabilities.voice && ' (Voice)'}
                    {number.capabilities.MMS && ' (MMS)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              Messaging Service SID
              <span className="ml-2 text-xs text-gray-400">(Optional - for advanced messaging)</span>
            </label>
            <input
              type="text"
              value={config.messagingServiceSid}
              onChange={(e) => setConfig(prev => ({ ...prev, messagingServiceSid: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          {/* Test Message */}
          {validationResult?.isValid && config.phoneNumber && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Send Test Message</p>
                  <p className="text-xs text-gray-400">Test SMS functionality</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                  placeholder="+1234567890"
                />
                <Button
                  onClick={sendTestMessage}
                  disabled={testMessageStatus === 'sending' || !testPhoneNumber}
                  variant={testMessageStatus === 'success' ? 'default' : 'outline'}
                >
                  {testMessageStatus === 'sending' ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : testMessageStatus === 'success' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Sent
                    </>
                  ) : testMessageStatus === 'failed' ? (
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

      {/* Usage Statistics */}
      {validationResult?.isValid && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage Statistics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{config.stats.messagesSent.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Messages Sent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{getDeliveryRate().toFixed(1)}%</p>
              <p className="text-sm text-gray-400">Delivery Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-500">{config.stats.callsMade.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Calls Made</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Message Delivery Rate</span>
                <span>{getDeliveryRate().toFixed(1)}%</span>
              </div>
              <Progress value={getDeliveryRate()} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Call Success Rate</span>
                <span>{getSuccessRate().toFixed(1)}%</span>
              </div>
              <Progress value={getSuccessRate()} className="h-2" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
              <span className="text-sm text-gray-400">Total Spend</span>
              <span className="font-semibold">${config.stats.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Message Settings */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Message Settings
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Status Callbacks</p>
                <p className="text-xs text-gray-400">Receive delivery updates</p>
              </div>
              <Switch
                checked={config.settings.statusCallbacks}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, statusCallbacks: checked }
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delivery Receipts</p>
                <p className="text-xs text-gray-400">Track message delivery</p>
              </div>
              <Switch
                checked={config.settings.deliveryReceipts}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, deliveryReceipts: checked }
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Smart Encoding</p>
                <p className="text-xs text-gray-400">Optimize message encoding</p>
              </div>
              <Switch
                checked={config.settings.smartEncoding}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, smartEncoding: checked }
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Shorten URLs</p>
                <p className="text-xs text-gray-400">Automatically shorten links</p>
              </div>
              <Switch
                checked={config.settings.shortenUrls}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, shortenUrls: checked }
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">
                Max Price per Message ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.settings.maxPrice}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, maxPrice: parseFloat(e.target.value) }
                }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">
                Validity Period (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="259200"
                value={config.settings.validityPeriod}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  settings: { ...prev.settings, validityPeriod: parseInt(e.target.value) }
                }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
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
                <p className="text-sm font-medium flex items-center gap-2">
                  {feature === 'sms' && <><MessageSquare className="h-3 w-3" /> SMS Messages</>}
                  {feature === 'voice' && <><Phone className="h-3 w-3" /> Voice Calls</>}
                  {feature === 'whatsapp' && <><MessageSquare className="h-3 w-3" /> WhatsApp</>}
                  {feature === 'video' && <><Video className="h-3 w-3" /> Video Calls</>}
                  {feature === 'verify' && <><Shield className="h-3 w-3" /> Phone Verification</>}
                  {feature === 'conversations' && <><Users className="h-3 w-3" /> Conversations API</>}
                </p>
                <p className="text-xs text-gray-400">
                  {feature === 'sms' && 'Send and receive text messages'}
                  {feature === 'voice' && 'Make and receive phone calls'}
                  {feature === 'whatsapp' && 'WhatsApp Business messaging'}
                  {feature === 'video' && 'Video calling and conferences'}
                  {feature === 'verify' && 'Two-factor authentication'}
                  {feature === 'conversations' && 'Omnichannel messaging'}
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

      {/* Phone Numbers */}
      {validationResult?.isValid && availableNumbers.length > 0 && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Numbers
          </h3>
          
          <div className="space-y-2">
            {availableNumbers.map((number) => (
              <div key={number.sid} className="p-3 bg-gray-900 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium">{number.phoneNumber}</p>
                  <p className="text-sm text-gray-400">{number.friendlyName}</p>
                </div>
                <div className="flex gap-1">
                  {number.capabilities.SMS && <Badge variant="outline" className="text-xs">SMS</Badge>}
                  {number.capabilities.voice && <Badge variant="outline" className="text-xs">Voice</Badge>}
                  {number.capabilities.MMS && <Badge variant="outline" className="text-xs">MMS</Badge>}
                </div>
              </div>
            ))}
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
            href="https://www.twilio.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            View Documentation
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://console.twilio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            Open Twilio Console
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
            Enable Twilio Integration
          </label>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!validationResult?.isValid || !config.enabled || !config.phoneNumber}
          >
            <Shield className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}