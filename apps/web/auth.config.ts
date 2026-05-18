import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

const githubConfigured =
  Boolean(process.env.AUTH_GITHUB_ID) &&
  Boolean(process.env.AUTH_GITHUB_SECRET);

export const authConfig: NextAuthConfig = {
  providers: githubConfigured
    ? [
        GitHub({
          clientId: process.env.AUTH_GITHUB_ID,
          clientSecret: process.env.AUTH_GITHUB_SECRET,
        }),
      ]
    : [],
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "user";
      }
      // Preserve role from the JWT payload when middleware decodes the session (no `user` on edge).
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) ?? "user";
      }
      return session;
    },
  },
};
