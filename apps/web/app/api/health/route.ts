import { NextResponse } from "next/server";

import { getInternalApiBaseUrl } from "@/lib/server-api";

export async function GET() {
  const base = getInternalApiBaseUrl();
  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        api: "unconfigured",
        detail: "Set INTERNAL_API_URL (e.g. http://127.0.0.1:4000) for API-backed health.",
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${base}/v1/health`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, api: "down", status: res.status },
        { status: 503 }
      );
    }
    const body = (await res.json()) as { status?: string };
    return NextResponse.json({ ok: true, api: "up", ...body });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ ok: false, api: "down", error: message }, { status: 503 });
  }
}
