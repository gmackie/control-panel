"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Copy, ExternalLink } from "lucide-react";

export default function OAuthFixPage() {
  const [config, setConfig] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error(err));
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // The correct callback URL that NextAuth expects
  const correctCallbackUrl = "https://gmac.io/api/auth/callback/github";

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Fix GitHub OAuth Configuration</h1>

      <div className="space-y-6">
        {/* Current Issue */}
        <Card className="p-6 border-red-900 bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold mb-2">OAuth Redirect Mismatch</h2>
              <p className="text-sm text-gray-300 mb-3">
                Your GitHub OAuth App is configured with the wrong callback URL.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="error">Wrong</Badge>
                  <code className="text-sm">https://gmac.io/oauth2/callback</code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">Correct</Badge>
                  <code className="text-sm">{correctCallbackUrl}</code>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Fix Instructions */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">How to Fix (2 Options)</h2>
          
          <div className="space-y-6">
            {/* Option 1 */}
            <div className="p-4 bg-gray-900 rounded-lg">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Badge>Option 1</Badge>
                Update GitHub OAuth App (Recommended)
              </h3>
              <ol className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">1.</span>
                  <div className="flex-1">
                    <p>Go to your GitHub OAuth Apps</p>
                    <a 
                      href="https://github.com/settings/developers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mt-1"
                    >
                      Open GitHub Settings
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">2.</span>
                  <div className="flex-1">
                    <p>Find your OAuth App with Client ID:</p>
                    <code className="text-sm bg-gray-800 px-2 py-1 rounded">Ov23liUoDijhtGOCmugS</code>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">3.</span>
                  <div className="flex-1">
                    <p>Update &quot;Authorization callback URL&quot; to:</p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 text-sm bg-gray-800 px-3 py-2 rounded">
                        {correctCallbackUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(correctCallbackUrl)}
                      >
                        {copied ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">4.</span>
                  <p>Click &quot;Update application&quot; to save</p>
                </li>
              </ol>
            </div>

            {/* Option 2 */}
            <div className="p-4 bg-gray-900 rounded-lg opacity-60">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Badge variant="secondary">Option 2</Badge>
                Keep Custom OAuth Path (Not Recommended)
              </h3>
              <p className="text-sm text-gray-400">
                If you need to keep using /oauth2/callback for SSO reasons, we would need to:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-400">
                <li>• Remove the custom OAuth route redirect</li>
                <li>• Configure NextAuth to use the custom callback URL</li>
                <li>• This is more complex and may break NextAuth features</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Current Configuration */}
        {config && (
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Current NextAuth Configuration</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">Provider</span>
                <code className="text-sm">GitHub</code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">Sign In URL</span>
                <code className="text-sm text-blue-400">{config.github?.signinUrl}</code>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">Expected Callback</span>
                <code className="text-sm text-green-400">{config.github?.callbackUrl}</code>
              </div>
            </div>
          </Card>
        )}

        {/* Test Button */}
        <div className="flex justify-center pt-4">
          <Button 
            onClick={() => window.location.href = "/auth/signin"}
            size="lg"
          >
            Test Sign In After Fixing
          </Button>
        </div>
      </div>
    </div>
  );
}