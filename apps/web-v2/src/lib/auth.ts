import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import AzureADProvider from "next-auth/providers/azure-ad";

const ALLOWED_DOMAINS = ["gmacko.com", "gmac.io"];
const ALLOWED_GITHUB_USERS = ["gmackie"];

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET!,
    }),
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID,
            authorization: {
              params: {
                scope: "openid profile email User.Read",
              },
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github") {
        const githubProfile = profile as { login?: string };
        if (githubProfile.login && ALLOWED_GITHUB_USERS.includes(githubProfile.login)) {
          return true;
        }
        return '/auth/error?error=Unauthorized';
      }

      if (account?.provider === "azure-ad") {
        const email = user.email?.toLowerCase();
        if (email) {
          const domain = email.split('@')[1];
          if (domain && ALLOWED_DOMAINS.includes(domain)) {
            return true;
          }
        }
        return '/auth/error?error=Unauthorized';
      }

      return false;
    },
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        token.provider = account.provider;
        token.accessToken = account.access_token;

        if (account.provider === "github") {
          const githubProfile = profile as { login?: string };
          token.username = githubProfile?.login;
        }

        if (account.provider === "azure-ad") {
          token.azureId = account.providerAccountId;
          const azureProfile = profile as {
            preferred_username?: string;
            name?: string;
            oid?: string;
          };
          token.username = azureProfile?.preferred_username?.split('@')[0];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub;
        (session.user as { provider?: string }).provider = token.provider as string;
        (session.user as { username?: string }).username = token.username as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string;
      username?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string;
    accessToken?: string;
    username?: string;
    azureId?: string;
  }
}
