"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Database,
  Key,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Shield,
  Globe,
  HardDrive,
  Activity,
  Settings,
  TestTube,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Terminal,
  Zap,
  Plus,
  Trash,
  GitBranch,
  Cloud,
} from "lucide-react";

interface TursoIntegrationFormProps {
  applicationId: string;
  existingConfig?: {
    databaseUrl?: string;
    authToken?: string;
    enabled: boolean;
    databases?: Array<{
      name: string;
      url: string;
      region: string;
      primaryRegion?: string;
    }>;
    features?: {
      embedding: boolean;
      replication: boolean;
      branches: boolean;
      migrations: boolean;
      backups: boolean;
    };
    monitoring?: {
      queryLogging: boolean;
      performanceMetrics: boolean;
      alerting: boolean;
    };
  };
  onSave: (config: any) => void;
  onCancel: () => void;
}

interface TursoValidationResult {
  isValid: boolean;
  organization?: string;
  database?: {
    name: string;
    region: string;
    version: string;
    size: number;
  };
  stats?: {
    rowsRead: number;
    rowsWritten: number;
    storageBytes: number;
  };
  error?: string;
}

interface DatabaseInfo {
  name: string;
  url: string;
  region: string;
  size: number;
  tables: number;
  created: string;
}

export function TursoIntegrationForm({
  applicationId,
  existingConfig,
  onSave,
  onCancel,
}: TursoIntegrationFormProps) {
  const [config, setConfig] = useState({
    databaseUrl: existingConfig?.databaseUrl || '',
    authToken: existingConfig?.authToken || '',
    enabled: existingConfig?.enabled || false,
    databases: existingConfig?.databases || [],
    features: existingConfig?.features || {
      embedding: false,
      replication: false,
      branches: false,
      migrations: true,
      backups: true,
    },
    monitoring: existingConfig?.monitoring || {
      queryLogging: true,
      performanceMetrics: true,
      alerting: false,
    },
  });

  const [showAuthToken, setShowAuthToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TursoValidationResult | null>(null);
  const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [showCreateDatabase, setShowCreateDatabase] = useState(false);
  const [newDatabase, setNewDatabase] = useState({
    name: '',
    region: 'iad', // Default to US East
  });

  const availableRegions = [
    { id: 'iad', name: 'US East (Virginia)', flag: '🇺🇸' },
    { id: 'ord', name: 'US Central (Chicago)', flag: '🇺🇸' },
    { id: 'sea', name: 'US West (Seattle)', flag: '🇺🇸' },
    { id: 'lhr', name: 'Europe (London)', flag: '🇬🇧' },
    { id: 'fra', name: 'Europe (Frankfurt)', flag: '🇩🇪' },
    { id: 'ams', name: 'Europe (Amsterdam)', flag: '🇳🇱' },
    { id: 'sin', name: 'Asia (Singapore)', flag: '🇸🇬' },
    { id: 'nrt', name: 'Asia (Tokyo)', flag: '🇯🇵' },
    { id: 'syd', name: 'Oceania (Sydney)', flag: '🇦🇺' },
  ];

  const validateConnection = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/integrations/turso/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseUrl: config.databaseUrl,
          authToken: config.authToken,
          applicationId,
        }),
      });

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        // Load databases after successful validation
        loadDatabases();
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: 'Failed to validate connection',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const testConnection = async () => {
    setTestConnectionStatus('testing');

    try {
      const response = await fetch('/api/integrations/turso/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseUrl: config.databaseUrl,
          authToken: config.authToken,
          applicationId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTestConnectionStatus('success');
      } else {
        setTestConnectionStatus('failed');
      }
    } catch (error) {
      setTestConnectionStatus('failed');
    }
  };

  const loadDatabases = async () => {
    setIsLoadingDatabases(true);

    try {
      const response = await fetch('/api/integrations/turso/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authToken: config.authToken,
          applicationId,
        }),
      });

      if (response.ok) {
        const dbs = await response.json();
        setDatabases(dbs);
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const createDatabase = async () => {
    if (!newDatabase.name) return;

    try {
      const response = await fetch('/api/integrations/turso/create-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authToken: config.authToken,
          name: newDatabase.name,
          region: newDatabase.region,
          applicationId,
        }),
      });

      if (response.ok) {
        const db = await response.json();
        setDatabases([...databases, db]);
        setShowCreateDatabase(false);
        setNewDatabase({ name: '', region: 'iad' });
      }
    } catch (error) {
      console.error('Failed to create database:', error);
    }
  };

  const handleSave = () => {
    if (!validationResult?.isValid) {
      alert('Please validate your connection first');
      return;
    }

    onSave({
      provider: 'turso',
      config: {
        databases: config.databases,
        features: config.features,
        monitoring: config.monitoring,
      },
      secrets: {
        TURSO_DATABASE_URL: config.databaseUrl,
        TURSO_AUTH_TOKEN: config.authToken,
      },
      enabled: config.enabled,
    });
  };

  // Generate example connection code
  const getExampleCode = () => {
    return `import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Example query
const result = await client.execute('SELECT * FROM users');
console.log(result.rows);`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-950/20 rounded-lg">
            <Database className="h-6 w-6 text-teal-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Turso Integration</h2>
            <p className="text-sm text-gray-400">Edge SQLite database with global replication</p>
          </div>
        </div>
        <Badge variant="secondary">
          <Cloud className="h-3 w-3 mr-1" />
          Edge Database
        </Badge>
      </div>

      {/* Connection Configuration */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
          Database Connection
        </h3>
        
        <div className="space-y-4">
          {/* Database URL */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Database URL *
              <span className="ml-2 text-xs text-gray-400">
                (libsql://[database]-[org].turso.io)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.databaseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, databaseUrl: e.target.value }))}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                placeholder="libsql://my-db-org.turso.io"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(config.databaseUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Auth Token */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Auth Token *
              <span className="ml-2 text-xs text-gray-400">
                (JWT token for authentication)
              </span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showAuthToken ? 'text' : 'password'}
                  value={config.authToken}
                  onChange={(e) => setConfig(prev => ({ ...prev, authToken: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg pr-10"
                  placeholder="eyJ..."
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
                onClick={validateConnection}
                disabled={!config.databaseUrl || !config.authToken || isValidating}
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
                    Connected to {validationResult.database?.name} in {validationResult.database?.region}
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

          {/* Test Connection */}
          {validationResult?.isValid && (
            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium">Test Query</p>
                <p className="text-xs text-gray-400">Run a test query to verify access</p>
              </div>
              <Button
                size="sm"
                onClick={testConnection}
                disabled={testConnectionStatus === 'testing'}
                variant={testConnectionStatus === 'success' ? 'default' : 'outline'}
              >
                {testConnectionStatus === 'testing' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : testConnectionStatus === 'success' ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Test Successful
                  </>
                ) : testConnectionStatus === 'failed' ? (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Test Failed
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    Run Test Query
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Database Stats */}
      {validationResult?.isValid && validationResult.stats && (
        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Database Statistics
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-400">Rows Read</p>
              <p className="text-2xl font-bold">
                {validationResult.stats.rowsRead.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Rows Written</p>
              <p className="text-2xl font-bold">
                {validationResult.stats.rowsWritten.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Storage Used</p>
              <p className="text-2xl font-bold">
                {(validationResult.stats.storageBytes / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Database Management */}
      {validationResult?.isValid && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Databases
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateDatabase(!showCreateDatabase)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Database
            </Button>
          </div>

          {showCreateDatabase && (
            <div className="p-4 bg-gray-900 rounded-lg mb-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Database Name</label>
                  <input
                    type="text"
                    value={newDatabase.name}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                    placeholder="my-database"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Region</label>
                  <select
                    value={newDatabase.region}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    {availableRegions.map(region => (
                      <option key={region.id} value={region.id}>
                        {region.flag} {region.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={createDatabase}>
                    Create
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateDatabase(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoadingDatabases ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : databases.length > 0 ? (
            <div className="space-y-2">
              {databases.map((db) => (
                <div key={db.name} className="p-3 bg-gray-900 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{db.name}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>{db.region}</span>
                      <span>•</span>
                      <span>{db.tables} tables</span>
                      <span>•</span>
                      <span>{(db.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <GitBranch className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No databases found. Create your first database above.
            </p>
          )}
        </Card>
      )}

      {/* Features Configuration */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Features
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(config.features).map(([feature, enabled]) => (
            <div key={feature} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium capitalize">
                  {feature === 'embedding' && 'Vector Embeddings'}
                  {feature === 'replication' && 'Global Replication'}
                  {feature === 'branches' && 'Database Branches'}
                  {feature === 'migrations' && 'Schema Migrations'}
                  {feature === 'backups' && 'Automatic Backups'}
                </p>
                <p className="text-xs text-gray-400">
                  {feature === 'embedding' && 'Store and query vector data'}
                  {feature === 'replication' && 'Multi-region data replication'}
                  {feature === 'branches' && 'Git-like database branching'}
                  {feature === 'migrations' && 'Version control for schema'}
                  {feature === 'backups' && 'Daily automated backups'}
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

      {/* Monitoring Configuration */}
      <Card className="p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Monitoring
        </h3>
        
        <div className="space-y-3">
          {Object.entries(config.monitoring).map(([setting, enabled]) => (
            <div key={setting} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {setting === 'queryLogging' && 'Query Logging'}
                  {setting === 'performanceMetrics' && 'Performance Metrics'}
                  {setting === 'alerting' && 'Alerting'}
                </p>
                <p className="text-xs text-gray-400">
                  {setting === 'queryLogging' && 'Log all database queries'}
                  {setting === 'performanceMetrics' && 'Track query performance'}
                  {setting === 'alerting' && 'Get alerts for issues'}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  monitoring: { ...prev.monitoring, [setting]: checked }
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
            href="https://docs.turso.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            View Documentation
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://turso.tech/app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            Open Turso Dashboard
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
            Enable Turso Integration
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