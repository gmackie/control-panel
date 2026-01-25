'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const AZURE_AD_CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID;
const AZURE_AD_TENANT_ID = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID;

interface MobileAuthState {
  platform: 'mobile';
  scheme: string;
  timestamp: number;
  nonce: string;
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encodeMobileState(state: MobileAuthState): string {
  return btoa(JSON.stringify(state));
}

function MobileAuthContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  
  const scheme = searchParams.get('scheme') || 'controlpanel';
  
  useEffect(() => {
    if (!AZURE_AD_CLIENT_ID || !AZURE_AD_TENANT_ID) {
      setError('OAuth not configured on server');
      return;
    }
    
    const mobileState: MobileAuthState = {
      platform: 'mobile',
      scheme,
      timestamp: Date.now(),
      nonce: generateNonce(),
    };
    
    const callbackUrl = `${window.location.origin}/api/auth/callback/azure-ad`;
    
    const authUrl = new URL(`https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', AZURE_AD_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', encodeMobileState(mobileState));
    authUrl.searchParams.set('prompt', 'select_account');
    
    window.location.href = authUrl.toString();
  }, [scheme]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center p-8">
          <div className="text-red-500 text-xl mb-4">Authentication Error</div>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to Microsoft sign-in...</p>
      </div>
    </div>
  );
}

function MobileAuthFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export default function MobileAuthPage() {
  return (
    <Suspense fallback={<MobileAuthFallback />}>
      <MobileAuthContent />
    </Suspense>
  );
}
