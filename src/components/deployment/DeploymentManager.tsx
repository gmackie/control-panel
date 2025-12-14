"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Loader2, Rocket, Server, GitBranch } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DeploymentForm {
  appName: string;
  domain: string;
  port: string;
  gitRepo: string;
  deploymentType: 'gitea' | 'direct' | 'quick';
}

export function DeploymentManager() {
  const [form, setForm] = useState<DeploymentForm>({
    appName: '',
    domain: '',
    port: '3000',
    gitRepo: '',
    deploymentType: 'gitea'
  });
  const [deploying, setDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    setDeploymentResult(null);

    try {
      const response = await fetch('/api/deployment/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          domain: form.domain || `${form.appName}.gmac.io`,
          port: parseInt(form.port)
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      setDeploymentResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-6 w-6" />
          Deploy New Application
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={form.deploymentType} onValueChange={(v) => setForm({...form, deploymentType: v as any})}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gitea">
              <GitBranch className="h-4 w-4 mr-2" />
              Full Deploy
            </TabsTrigger>
            <TabsTrigger value="quick">
              <Rocket className="h-4 w-4 mr-2" />
              Quick Deploy
            </TabsTrigger>
            <TabsTrigger value="direct">
              <Server className="h-4 w-4 mr-2" />
              Direct Deploy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gitea" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gitRepo">Git Repository Path</Label>
              <Input
                id="gitRepo"
                placeholder="/path/to/your/app"
                value={form.gitRepo}
                onChange={(e) => setForm({...form, gitRepo: e.target.value})}
              />
              <p className="text-xs text-muted-foreground">
                Full path to your local repository
              </p>
            </div>
          </TabsContent>

          <TabsContent value="quick" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Quick deploy for existing Gitea repositories. The repo should already exist at git.gmac.io/gmackie/{form.appName || 'your-app'}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="direct" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Direct deployment without Git. Deploys a simple nginx container for testing.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="appName">Application Name</Label>
            <Input
              id="appName"
              placeholder="my-awesome-app"
              value={form.appName}
              onChange={(e) => setForm({...form, appName: e.target.value})}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain (optional)</Label>
            <Input
              id="domain"
              placeholder={`${form.appName || 'app'}.gmac.io`}
              value={form.domain}
              onChange={(e) => setForm({...form, domain: e.target.value})}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use {form.appName || 'app'}.gmac.io
            </p>
          </div>

          {form.deploymentType !== 'direct' && (
            <div className="space-y-2">
              <Label htmlFor="port">Application Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="3000"
                value={form.port}
                onChange={(e) => setForm({...form, port: e.target.value})}
              />
            </div>
          )}

          <Button 
            onClick={handleDeploy} 
            disabled={deploying || !form.appName || (form.deploymentType === 'gitea' && !form.gitRepo)}
            className="w-full"
          >
            {deploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Deploy Application
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {deploymentResult && (
          <Alert className="mt-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Deployment Successful!</p>
                <div className="text-sm space-y-1">
                  <p>🌐 URL: <a href={deploymentResult.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{deploymentResult.url}</a></p>
                  <p>📊 ArgoCD: <a href={deploymentResult.argocdUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View in ArgoCD</a></p>
                  <p>🏷️ App Name: {deploymentResult.appName}</p>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">View deployment logs</summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {deploymentResult.logs}
                  </pre>
                </details>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}