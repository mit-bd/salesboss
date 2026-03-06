import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ============ PUBLIC ACTIONS ============
    if (action === "check_admin_exists") {
      const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("id").eq("role", "admin").limit(1);
      return json({ adminExists: (adminRoles?.length || 0) > 0 });
    }

    if (action === "check_owner_exists") {
      const { data: ownerRoles } = await supabaseAdmin.from("user_roles").select("id").eq("role", "owner").limit(1);
      return json({ ownerExists: (ownerRoles?.length || 0) > 0 });
    }

    // ============ AUTH CHECK ============
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !caller) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    const callerRole = roleData?.role;

    // ============ OWNER ACTIONS ============
    if (callerRole === "owner") {
      if (action === "list_requests") {
        const { data } = await supabaseAdmin.from("project_requests").select("*").order("created_at", { ascending: false });
        return json({ requests: data });
      }

      if (action === "approve_request") {
        const { requestId } = body;
        const { data: request } = await supabaseAdmin.from("project_requests").select("*").eq("id", requestId).single();
        if (!request) return json({ error: "Request not found" }, 404);

        const { data: project, error: projError } = await supabaseAdmin.from("projects").insert({
          business_name: request.business_name,
          owner_user_id: request.user_id,
        }).select().single();
        if (projError) return json({ error: projError.message }, 500);

        await supabaseAdmin.from("user_roles").insert({ user_id: request.user_id, role: "admin" });
        await supabaseAdmin.from("profiles").update({ project_id: project.id }).eq("user_id", request.user_id);
        await supabaseAdmin.from("project_requests").update({
          status: "approved",
          reviewed_by: caller.id,
          reviewed_at: new Date().toISOString(),
          project_id: project.id,
        }).eq("id", requestId);

        return json({ success: true, project });
      }

      if (action === "reject_request") {
        const { requestId } = body;
        await supabaseAdmin.from("project_requests").update({
          status: "rejected",
          reviewed_by: caller.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", requestId);
        return json({ success: true });
      }

      if (action === "list_projects") {
        const { data } = await supabaseAdmin.from("projects").select("*").order("created_at", { ascending: false });
        return json({ projects: data });
      }

      if (action === "toggle_project") {
        const { projectId, isActive } = body;
        await supabaseAdmin.from("projects").update({ is_active: isActive }).eq("id", projectId);
        return json({ success: true });
      }

      if (action === "dashboard_stats") {
        const { count: totalProjects } = await supabaseAdmin.from("projects").select("*", { count: "exact", head: true });
        const { count: pendingRequests } = await supabaseAdmin.from("project_requests").select("*", { count: "exact", head: true }).eq("status", "pending");
        const { count: activeProjects } = await supabaseAdmin.from("projects").select("*", { count: "exact", head: true }).eq("is_active", true);
        const { count: totalUsers } = await supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).neq("role", "owner");
        return json({
          totalProjects: totalProjects || 0,
          pendingRequests: pendingRequests || 0,
          activeProjects: activeProjects || 0,
          totalUsers: totalUsers || 0,
        });
      }

      return json({ error: "Unknown action" }, 400);
    }

    // ============ ADMIN ACTIONS ============
    if (callerRole !== "admin") return json({ error: "Forbidden: Admin only" }, 403);

    // Get caller's project_id for project isolation
    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("project_id").eq("user_id", caller.id).maybeSingle();
    const callerProjectId = callerProfile?.project_id;

    if (action === "create") {
      const { email, password, fullName, role } = body;
      if (!email || !password || !role) return json({ error: "email, password, and role are required" }, 400);

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || "" },
      });
      if (createError) return json({ error: createError.message }, 400);

      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
      if (roleError) return json({ error: roleError.message }, 400);

      // Assign same project_id as the admin
      if (callerProjectId) {
        await supabaseAdmin.from("profiles").update({ project_id: callerProjectId }).eq("user_id", newUser.user.id);
      }

      return json({ success: true, userId: newUser.user.id });
    }

    if (action === "reset_password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) return json({ error: "userId and newPassword required" }, 400);
      const { error } = await supabaseAdmin.auth.admin.updateUser(userId, { password: newPassword });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "update_role") {
      const { userId, role } = body;
      if (!userId || !role) return json({ error: "userId and role required" }, 400);
      if (userId === caller.id) return json({ error: "Cannot change your own role" }, 400);
      const { error } = await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "update_user") {
      const { userId, fullName, email } = body;
      if (!userId) return json({ error: "userId required" }, 400);
      const updates: any = {};
      if (email) updates.email = email;
      if (fullName !== undefined) updates.user_metadata = { full_name: fullName };
      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin.auth.admin.updateUser(userId, updates);
        if (error) return json({ error: error.message }, 400);
      }
      if (fullName !== undefined) {
        await supabaseAdmin.from("profiles").update({ full_name: fullName }).eq("user_id", userId);
      }
      return json({ success: true });
    }

    if (action === "list_users") {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) return json({ error: error.message }, 400);

      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, full_name, project_id");
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // Filter users by project_id
      const result = users
        .filter((u: any) => {
          const prof = profileMap.get(u.id);
          const userRole = roleMap.get(u.id);
          if (userRole === "owner") return false; // Don't show owner in admin's list
          if (!callerProjectId) return true; // No project filter
          return prof?.project_id === callerProjectId;
        })
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          fullName: profileMap.get(u.id)?.full_name || u.user_metadata?.full_name || "",
          role: roleMap.get(u.id) || null,
          createdAt: u.created_at,
          lastSignIn: u.last_sign_in_at,
          emailConfirmed: !!u.email_confirmed_at,
          banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
        }));

      return json({ users: result });
    }

    if (action === "toggle_ban") {
      const { userId, ban } = body;
      if (!userId) return json({ error: "userId required" }, 400);
      if (userId === caller.id) return json({ error: "Cannot deactivate yourself" }, 400);
      const banData = ban ? { ban_duration: "876600h" } : { ban_duration: "none" };
      const { error } = await supabaseAdmin.auth.admin.updateUser(userId, banData as any);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
