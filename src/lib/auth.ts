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
