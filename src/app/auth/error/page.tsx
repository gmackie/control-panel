"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "AccessDenied":
        return "Access denied. Only authorized GitHub accounts are allowed.";
      case "Configuration":
        return "Authentication configuration error. Please check OAuth settings.";
      case "Verification":
        return "Verification failed. Please try again.";
      case "OAuthSignin":
        return "Error during OAuth sign in. Check GitHub app configuration.";
      case "OAuthCallback":
        return "OAuth callback error. Verify redirect URI matches GitHub app settings.";
      case "OAuthCreateAccount":
        return "Could not create user account from OAuth data.";
      case "EmailCreateAccount":
        return "Could not create user account from email.";
      case "Callback":
        return "OAuth callback error. Check redirect URI configuration.";
      default:
        return `Authentication error: ${error || 'Unknown error occurred'}`;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {getErrorMessage(error)}
          </p>
          {error && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-400 font-mono">
                Error code: {error}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                If this error persists, ensure your GitHub OAuth app has:
              </p>
              <ul className="text-xs text-gray-400 mt-1 list-disc list-inside">
                <li>Authorization callback URL must be exactly: <code className="bg-gray-800 px-1 rounded">https://gmac.io/oauth2/callback</code></li>
                <li>Homepage URL: <code className="bg-gray-800 px-1 rounded">https://gmac.io</code></li>
                <li>Application name: GMAC.IO Control Panel (or similar)</li>
              </ul>
              <div className="mt-3 p-3 bg-yellow-950/20 border border-yellow-900 rounded text-xs">
                <p className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <span>
                    Make sure the callback URL matches exactly, including the protocol (https://).
                    Do not include a trailing slash or any extra parameters.
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 space-y-6">
          <Link
            href="/auth/signin"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
