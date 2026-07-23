import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface EdgeContext {
  functionName: string;
  requestId: string;
  executionId: string;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export function createEdgeContext(functionName: string, req: Request): EdgeContext {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const executionId = Deno.env.get("SB_EXECUTION_ID") || Deno.env.get("EDGE_RUNTIME_EXECUTION_ID") || requestId;
  return { functionName, requestId, executionId };
}

export function logEdge(ctx: EdgeContext, level: "info" | "warn" | "error", event: string, details: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    level,
    event,
    function: ctx.functionName,
    request_id: ctx.requestId,
    function_execution_id: ctx.executionId,
    ...details,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export function jsonResponse(
  ctx: EdgeContext,
  corsHeaders: Record<string, string>,
  body: Record<string, unknown>,
  status = 200,
) {
  const responseBody = {
    ...body,
    request_id: ctx.requestId,
    function_execution_id: ctx.executionId,
  };
  logEdge(ctx, status >= 500 ? "error" : status >= 400 ? "warn" : "info", "response", {
    status,
    error: typeof body.error === "string" ? body.error : undefined,
    backend_error: typeof body.backend_error === "string" ? body.backend_error : undefined,
    supabase_error: typeof body.supabase_error === "string" ? body.supabase_error : undefined,
  });
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Request-ID": ctx.requestId,
      "X-Function-Execution-ID": ctx.executionId,
    },
  });
}

export async function authenticateUser(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ user?: AuthenticatedUser; error?: string; supabaseError?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await callerClient.auth.getClaims(token);
  const userId = data?.claims?.sub as string | undefined;
  const email = data?.claims?.email as string | undefined;

  if (error || !userId) {
    return {
      error: "Unauthorized",
      supabaseError: error?.message || "JWT claims were not present",
    };
  }

  return { user: { id: userId, email } };
}