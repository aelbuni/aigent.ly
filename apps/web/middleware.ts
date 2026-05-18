import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const ADMIN_BYPASS = process.env.ADMIN_BYPASS === "true";

/**
 * Admin authorization runs in `app/(admin)/layout.tsx` via `auth()` from `@/auth`
 * (DB-backed role sync). Do not gate `role === "admin"` here: this middleware uses a
 * separate NextAuth instance and often does not see custom JWT claims like `role`.
 */
export default auth((req) => {
  if (ADMIN_BYPASS) return;
  if (req.nextUrl.pathname.startsWith("/admin") && !req.auth) {
    return Response.redirect(new URL("/api/auth/signin", req.url));
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
