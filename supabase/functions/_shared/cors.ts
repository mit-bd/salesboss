// Shared CORS helper with origin allowlist for production hardening.
// Reflects the request Origin only if it matches an allowed pattern,
// otherwise omits Access-Control-Allow-Origin so browsers block the response.

const STATIC_ALLOW = new Set<string>([
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://salesboss.lovable.app",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ALLOW.has(origin)) return true;

  // Any *.lovable.app / *.lovable.dev subdomain (preview + custom)
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.hostname.endsWith(".lovable.app")) return true;
    if (u.hostname.endsWith(".lovable.dev")) return true;
    if (u.hostname.endsWith(".lovableproject.com")) return true;
    if (u.hostname.endsWith(".lovable.host")) return true;
  } catch {
    return false;
  }

  // Custom allowlist via env, comma-separated exact origins
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }
  return headers;
}
