export async function POST(req: Request) {
  const INTERNAL_API_URL = process.env.INTERNAL_API_URL;
  if (!INTERNAL_API_URL) {
    return new Response("[error: INTERNAL_API_URL not set]", { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("[error: invalid JSON]", { status: 400 });
  }

  try {
    const upstream = await fetch(`${INTERNAL_API_URL}/v1/summarize/stream`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("[error: upstream failed]", { status: upstream.status });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("[error: connection failed]", { status: 502 });
  }
}
