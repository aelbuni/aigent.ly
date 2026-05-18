import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";

import { db } from "@/lib/db";
import {
  account,
  authenticator,
  session,
  user,
  verificationToken,
} from "@/lib/db/schema";

import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  session: { strategy: "jwt" },
  adapter: DrizzleAdapter(db, {
    usersTable: user,
    accountsTable: account,
    sessionsTable: session,
    verificationTokensTable: verificationToken,
    authenticatorsTable: authenticator,
  }),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user: u }) {
      if (u) {
        token.role = (u as { role?: string }).role ?? "user";
      }
      // Always sync role from DB so promotions apply without a manual sign-out cycle.
      if (token.sub) {
        const dbUser = await db.query.user.findFirst({
          where: (t, { eq }) => eq(t.id, token.sub!),
          columns: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = (token.role as string) ?? "user";
      return session;
    },
  },
});
