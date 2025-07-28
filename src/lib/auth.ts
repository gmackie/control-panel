import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

interface GitHubProfile {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        url: "https://github.com/login/oauth/authorize",
        params: {
          scope: "read:user user:email",
          redirect_uri: `${process.env.NEXTAUTH_URL}/oauth2/callback`,
        },
      },
      token: {
        url: "https://github.com/login/oauth/access_token",
        params: {
          redirect_uri: `${process.env.NEXTAUTH_URL}/oauth2/callback`,
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow access to gmackie GitHub account
      if (
        account?.provider === "github" &&
        (profile as GitHubProfile)?.login === "gmackie"
      ) {
        return true;
      }
      return false;
    },
    async jwt({ token, user, account, profile }) {
      if (
        account?.provider === "github" &&
        (profile as GitHubProfile)?.login === "gmackie"
      ) {
        const githubProfile = profile as GitHubProfile;
        token.user = {
          id: githubProfile.id,
          name: githubProfile.name || githubProfile.login,
          email: githubProfile.email,
          image: githubProfile.avatar_url,
          login: githubProfile.login,
        };
      }
      return token;
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = token.user as any;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
