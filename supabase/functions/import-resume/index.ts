import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { authenticateUser, createEdgeContext, jsonResponse, logEdge } from "../_shared/edge.ts";

serve(async (req) => {
  const edge = createEdgeContext("import-resume", req);
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    logEdge(edge, "info", "request_started", { method: req.method });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = await authenticateUser(req, supabaseUrl, anonKey);
    if (auth.error || !auth.user) return json(edge, corsHeaders, 401, { error: "Unauthorized", backend_error: auth.error, supabase_error: auth.supabaseError });
    const user = auth.user;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: prof } = await admin.from("profiles").select("project_id, full_name").eq("user_id", user.id).maybeSingle();
    const projectId = prof?.project_id;
    if (!projectId) return json(corsHeaders, 400, { error: "No project" });

    const { import_run_id } = await req.json();
    if (!import_run_id) return json(corsHeaders, 400, { error: "import_run_id required" });

    // Ensure caller owns the run's project
    const { data: run } = await admin.from("import_runs").select("id, project_id").eq("id", import_run_id).maybeSingle();
    if (!run || run.project_id !== projectId) return json(corsHeaders, 403, { error: "Forbidden" });

    const { data: result, error } = await admin.rpc("resume_import_run", {
      p_run_id: import_run_id, p_user_id: user.id, p_user_name: prof?.full_name ?? user.email ?? "user",
    });
    if (error) return json(edge, corsHeaders, 500, { error: error.message, supabase_error: error.message });

    return json(edge, corsHeaders, 200, { ok: true, result });
  } catch (e) {
    logEdge(edge, "error", "unhandled_exception", { backend_error: (e as Error).message });
    return json(edge, buildCorsHeaders(req), 500, { error: (e as Error).message, backend_error: (e as Error).message });
  }
});

function json(edge: ReturnType<typeof createEdgeContext>, headers: Record<string, string>, status: number, body: Record<string, unknown>) {
  return jsonResponse(edge, headers, body, status);
}
