import { cookies } from 'next/headers';
import crypto from 'crypto';

const GITHUB_CLIENT_ID = process.env.GITHUB_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_SECRET!;
const ALLOWED_USER = 'gmackie'; // Only allow your GitHub username

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  login: string;
  id: number;
}

export class GitHubOAuth {
  private static readonly GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
  private static readonly GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
  private static readonly GITHUB_USER_API = 'https://api.github.com/user';
  
  static generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      state,
      scope: 'read:user',
    });
    
    return `${this.GITHUB_OAUTH_URL}?${params.toString()}`;
  }

  static async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    const response = await fetch(this.GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data: GitHubTokenResponse = await response.json();
    return data.access_token;
  }

  static async getUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch(this.GITHUB_USER_API, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    return response.json();
  }

  static async authenticate(code: string, state: string, redirectUri: string): Promise<boolean> {
    try {
      // Exchange code for token
      const accessToken = await this.exchangeCodeForToken(code, redirectUri);
      
      // Get user info
      const user = await this.getUser(accessToken);
      
      // Check if it's the allowed user
      if (user.login !== ALLOWED_USER) {
        return false;
      }

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const cookieStore = cookies();
      
      // Store session (expires in 30 days)
      cookieStore.set('auth-token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      // Store user info
      cookieStore.set('github-user', user.login, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  static async signOut() {
    const cookieStore = cookies();
    cookieStore.delete('auth-token');
    cookieStore.delete('github-user');
  }

  static async getSession() {
    const cookieStore = cookies();
    const authToken = cookieStore.get('auth-token');
    const githubUser = cookieStore.get('github-user');

    if (!authToken || !githubUser) {
      return null;
    }

    return {
      user: githubUser.value,
      authenticated: true,
    };
  }
}