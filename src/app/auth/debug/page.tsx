"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Copy, ExternalLink } from "lucide-react";

export default function AuthDebugPage() {
  const [config, setConfig] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/test")
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error(err));
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const redirectUri = "https://gmac.io/oauth2/callback";

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">OAuth Configuration Debug</h1>

      <div className="space-y-6">
        {/* Current Issue */}
        <Card className="p-6 border-red-900 bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold mb-2">GitHub OAuth Error</h2>
              <p className="text-sm text-gray-300 mb-3">
                The redirect_uri is not associated with this application. 
                Your GitHub OAuth App needs to be updated.
              </p>
            </div>
          </div>
        </Card>

        {/* Solution */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">How to Fix</h2>
          <ol className="space-y-4">
            <li>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">1</Badge>
                <div className="flex-1">
                  <p className="font-medium mb-1">Go to GitHub OAuth Apps</p>
                  <a 
                    href="https://github.com/settings/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Open GitHub Settings
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </li>
            <li>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">2</Badge>
                <div className="flex-1">
                  <p className="font-medium mb-1">Find your OAuth App</p>
                  <p className="text-sm text-gray-400">
                    Look for the app using Client ID from your .env.local
                  </p>
                </div>
              </div>
            </li>
            <li>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">3</Badge>
                <div className="flex-1">
                  <p className="font-medium mb-2">Update Authorization callback URL</p>
                  <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-md">
                    <code className="flex-1 text-sm">{redirectUri}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(redirectUri)}
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Copy this exact URL and paste it in the GitHub OAuth App settings
                  </p>
                </div>
              </div>
            </li>
            <li>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5">4</Badge>
                <div className="flex-1">
                  <p className="font-medium mb-1">Save changes</p>
                  <p className="text-sm text-gray-400">
                    Click &quot;Update application&quot; to save
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </Card>

        {/* Current Configuration */}
        {config && (
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Current Configuration</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">NEXTAUTH_URL</span>
                <code className="text-sm">{config.NEXTAUTH_URL}</code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">GitHub OAuth Configured</span>
                {config.GITHUB_ID_EXISTS ? (
                  <Badge variant="success">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="error">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    No
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">Required Callback URL</span>
                <code className="text-sm text-green-400">{redirectUri}</code>
              </div>
            </div>
          </Card>
        )}

        {/* Additional Notes */}
        <Card className="p-6 bg-blue-950/20 border-blue-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium mb-2">Important Notes</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• The callback URL must match exactly (including https://)</li>
                <li>• This setup enables SSO across all gmac.io subdomains</li>
                <li>• Changes may take a few minutes to propagate</li>
                <li>• Clear your browser cache if issues persist</li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="flex justify-center pt-4">
          <Button onClick={() => window.location.href = "/auth/signin"}>
            Try Sign In Again
          </Button>
        </div>
      </div>
    </div>
  );
}