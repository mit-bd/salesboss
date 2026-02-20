import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_USERS = [
  {
    email: "mujahid.demo@salesboss.test",
    password: "Demo@1234",
    fullName: "Mujahid Islam",
    role: "sub_admin" as const,
  },
  {
    email: "hasan.demo@salesboss.test",
    password: "Demo@1234",
    fullName: "Hasan",
    role: "sales_executive" as const,
  },
  {
    email: "kajal.demo@salesboss.test",
    password: "Demo@1234",
    fullName: "Kajal",
    role: "sales_executive" as const,
  },
  {
    email: "peyarul.demo@salesboss.test",
    password: "Demo@1234",
    fullName: "Peyarul",
    role: "sales_executive" as const,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Require admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "seed") {
      const results: any[] = [];

      for (const demo of DEMO_USERS) {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email === demo.email);

        if (existing) {
          results.push({ email: demo.email, status: "already_exists", userId: existing.id });
          continue;
        }

        // Create user with auto-confirm
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: demo.email,
          password: demo.password,
          email_confirm: true,
          user_metadata: { full_name: demo.fullName, demo_user: true },
        });

        if (createError) {
          results.push({ email: demo.email, status: "error", error: createError.message });
          continue;
        }

        // Assign role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role: demo.role });

        if (roleError) {
          results.push({ email: demo.email, status: "created_no_role", error: roleError.message, userId: newUser.user.id });
          continue;
        }

        results.push({ email: demo.email, status: "created", role: demo.role, userId: newUser.user.id });
      }

      // Fix sub_admin permissions: remove orders.delete per requirements
      await supabaseAdmin
        .from("role_permissions")
        .delete()
        .eq("role", "sub_admin")
        .eq("permission_key", "orders.delete");

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cleanup") {
      // Remove demo users
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
      const demoEmails = DEMO_USERS.map((d) => d.email);
      const removed: string[] = [];

      for (const u of allUsers?.users || []) {
        if (demoEmails.includes(u.email || "")) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", u.id);
          await supabaseAdmin.from("profiles").delete().eq("user_id", u.id);
          await supabaseAdmin.auth.admin.deleteUser(u.id);
          removed.push(u.email || "");
        }
      }

      return new Response(JSON.stringify({ success: true, removed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'seed' or 'cleanup'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
