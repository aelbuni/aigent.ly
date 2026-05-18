# Hostinger Deployment

The app is configured for Hostinger VPS deployment using Next.js standalone output.

## Local note (before deploying)

On your machine, do not run `npm run dev` and `npm run start` together in the same `apps/web` tree. They share `.next`; running dev after `next start` can leave production serving stale asset hashes and break CSS until you stop the old process and rebuild.

## Build

```bash
npm run build          # from monorepo root
# or
npm run build -w web   # web only
```

The build produces:
- `.next/standalone/` — self-contained Node.js server (includes all deps)
- `.next/standalone/apps/web/.next/static/` — static assets (copied by postbuild)
- `.next/standalone/apps/web/public/` — public assets (copied by postbuild)

## What makes it Hostinger-compatible

`apps/web/next.config.ts`:
```ts
output: "standalone",           // bundles Node.js server + only used deps
outputFileTracingRoot: monorepoRoot,  // traces files from monorepo root correctly
```

The `postbuild` script in `apps/web/package.json` copies assets into standalone:
```bash
cp -r .next/static .next/standalone/apps/web/.next/static
cp -r public .next/standalone/apps/web/public
```

## Running on Hostinger

Upload `.next/standalone/` to the server, then:

```bash
node apps/web/server.js
# or with PORT:
PORT=3000 node apps/web/server.js
```

Required environment variables on Hostinger:
```
DATABASE_URL=postgres://...
AUTH_SECRET=...            # generate with: openssl rand -base64 32
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
NEXTAUTH_URL=https://yourdomain.com
```

## Admin access

After first deployment, set your user's role to admin:
```sql
UPDATE "user" SET role = 'admin' WHERE email = 'your@email.com';
```

Then sign in via GitHub at `/api/auth/signin`. The `/admin` route will be accessible.
