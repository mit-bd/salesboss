import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Manual trigger for followup automation.
 *
 * Security model:
 *  - Scheduled runs do NOT hit this endpoint. pg_cron invokes
 *    public.run_followup_automation() directly inside the database,
 *    so no shared HTTP secret is exposed anywhere.
 *  - This endpoint exists ONLY for on-demand admin/owner triggering.
 *
 * Two accepted invocation modes:
 *   1. Authenticated user with role 'admin' or 'owner' (Authorization: Bearer <jwt>).
 *   2. Server-side callers presenting the shared secret in the
 *      `x-cron-secret` header (matches FOLLOWUP_AUTOMATION_SECRET env var).
 *
 * The anon key alone is NEVER enough. Unauthenticated / unauthorized
 * requests are rejected with 401 / 403.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = Deno.env.get("FOLLOWUP_AUTOMATION_SECRET") ?? "";

  // --- Authorize ---
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  const secretOk = cronSecret.length > 0 && providedSecret === cronSecret;

  let authorized = secretOk;

  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }
    const token = authHeader.slice("Bearer ".length);

    // Verify the JWT and resolve the user
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json(401, { error: "Invalid token" });
    }
    const userId = claimsData.claims.sub as string;

    // Role check via trusted server-side function (uses service role)
    const adminClient = createClient(supabaseUrl, serviceKey);
    const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
      adminClient.rpc("has_role", { _user_id: userId, _role: "admin" }),
      adminClient.rpc("has_role", { _user_id: userId, _role: "owner" }),
    ]);
    if (!isAdmin && !isOwner) {
      return json(403, { error: "Forbidden" });
    }
    authorized = true;
  }

  if (!authorized) return json(401, { error: "Unauthorized" });

  // --- Execute (delegates to the atomic, concurrency-safe DB routine) ---
  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.rpc("run_followup_automation");
    if (error) {
      console.error("run_followup_automation error:", error.message);
      return json(500, { success: false, error: error.message });
    }
    return json(200, { success: true, result: data });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json(500, { success: false, error: String(err) });
  }
});
