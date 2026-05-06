import { headers } from "next/headers";

import { createServerApiClient } from "@aigently/api-client";

export function getInternalApiBaseUrl(): string | null {
  const raw = process.env.INTERNAL_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** Server-only typed client; `null` when `INTERNAL_API_URL` is unset (local static fallback). */
export async function getServerApiClient() {
  const base = getInternalApiBaseUrl();
  if (!base) return null;
  const cookie = (await headers()).get("cookie");
  return createServerApiClient(base, { cookieHeader: cookie });
}

/**
 * `openapi-fetch` throws on network errors (e.g. API not running). RSC should not 500 when only Next is up.
 */
export async function tryInternal<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
