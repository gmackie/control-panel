"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Github } from "lucide-react";

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    fetch("/api/auth/session")
      .then(res => res.json())
      .then(session => {
        if (session?.authenticated) {
          router.push("/");
        }
      })
      .catch(() => {});
  }, [router]);

  const handleGitHubSignIn = () => {
    setIsLoading(true);
    const clientId = 'Ov23liUoDijhtGOCmugS';
    const redirectUri = 'https://gmac.io/oauth2/callback';
    const state = Math.random().toString(36).substring(7);
    
    // Store state for CSRF protection
    sessionStorage.setItem('oauth-state', state);
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'read:user',
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Sign in to GMAC.IO</h1>
          <p className="text-gray-400">Control Panel Access</p>
        </div>

        <Button
          onClick={handleGitHubSignIn}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          <Github className="mr-2 h-5 w-5" />
          {isLoading ? "Signing in..." : "Sign in with GitHub"}
        </Button>

        <p className="text-sm text-gray-400 text-center mt-4">
          Only authorized users can access this panel
        </p>
      </Card>
    </div>
  );
}
