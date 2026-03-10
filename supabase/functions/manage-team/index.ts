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

      if (action === "edit_request") {
        const { requestId, businessName, ownerName, email, phone } = body;
        if (!requestId) return json({ error: "requestId required" }, 400);
        const updates: any = {};
        if (businessName !== undefined) updates.business_name = businessName;
        if (ownerName !== undefined) updates.owner_name = ownerName;
        if (email !== undefined) updates.email = email;
        if (phone !== undefined) updates.phone = phone;
        await supabaseAdmin.from("project_requests").update(updates).eq("id", requestId);
        return json({ success: true });
      }

      if (action === "delete_request") {
        const { requestId } = body;
        if (!requestId) return json({ error: "requestId required" }, 400);
        await supabaseAdmin.from("project_requests").delete().eq("id", requestId);
        return json({ success: true });
      }

      if (action === "list_projects") {
        const { data: projects } = await supabaseAdmin.from("projects").select("*").order("created_at", { ascending: false });
        const enriched = await Promise.all((projects || []).map(async (project: any) => {
          const { data: adminProfile } = await supabaseAdmin.from("profiles")
            .select("full_name")
            .eq("user_id", project.owner_user_id)
            .maybeSingle();
          const { count: userCount } = await supabaseAdmin.from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);
          const { count: orderCount } = await supabaseAdmin.from("orders")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("is_deleted", false);
          const { data: { users: adminUsers } } = await supabaseAdmin.auth.admin.listUsers();
          const adminUser = adminUsers?.find((u: any) => u.id === project.owner_user_id);
          return {
            ...project,
            admin_name: adminProfile?.full_name || "Unknown",
            admin_email: adminUser?.email || "",
            total_users: userCount || 0,
            total_orders: orderCount || 0,
          };
        }));
        return json({ projects: enriched });
      }

      if (action === "toggle_project") {
        const { projectId, isActive } = body;
        await supabaseAdmin.from("projects").update({ is_active: isActive }).eq("id", projectId);
        return json({ success: true });
      }

      if (action === "delete_project") {
        const { projectId } = body;
        if (!projectId) return json({ error: "projectId required" }, 400);
        await supabaseAdmin.from("orders").delete().eq("project_id", projectId);
        await supabaseAdmin.from("customers").delete().eq("project_id", projectId);
        await supabaseAdmin.from("products").delete().eq("project_id", projectId);
        await supabaseAdmin.from("delivery_methods").delete().eq("project_id", projectId);
        await supabaseAdmin.from("order_sources").delete().eq("project_id", projectId).eq("is_system", false);
        const { data: projectProfiles } = await supabaseAdmin.from("profiles").select("user_id").eq("project_id", projectId);
        if (projectProfiles) {
          for (const p of projectProfiles) {
            await supabaseAdmin.from("user_roles").delete().eq("user_id", p.user_id);
          }
        }
        await supabaseAdmin.from("profiles").update({ project_id: null }).eq("project_id", projectId);
        await supabaseAdmin.from("projects").delete().eq("id", projectId);
        return json({ success: true });
      }

      if (action === "reset_project") {
        const { projectId } = body;
        if (!projectId) return json({ error: "projectId required" }, 400);
        await supabaseAdmin.from("orders").delete().eq("project_id", projectId);
        await supabaseAdmin.from("customers").delete().eq("project_id", projectId);
        await supabaseAdmin.from("products").delete().eq("project_id", projectId);
        await supabaseAdmin.from("delivery_methods").delete().eq("project_id", projectId);
        return json({ success: true });
      }

      if (action === "update_project") {
        const { projectId, businessName, expiryDate } = body;
        if (!projectId) return json({ error: "projectId required" }, 400);
        const updates: any = {};
        if (businessName) updates.business_name = businessName;
        if (expiryDate !== undefined) updates.expiry_date = expiryDate;
        await supabaseAdmin.from("projects").update(updates).eq("id", projectId);
        return json({ success: true });
      }

      if (action === "set_expiry") {
        const { projectId, expiryDate } = body;
        if (!projectId) return json({ error: "projectId required" }, 400);
        await supabaseAdmin.from("projects").update({ expiry_date: expiryDate }).eq("id", projectId);
        return json({ success: true });
      }

      if (action === "extend_expiry") {
        const { projectId, days } = body;
        if (!projectId || !days) return json({ error: "projectId and days required" }, 400);
        const { data: project } = await supabaseAdmin.from("projects").select("expiry_date").eq("id", projectId).single();
        if (!project) return json({ error: "Project not found" }, 404);
        const base = project.expiry_date ? new Date(project.expiry_date) : new Date();
        base.setDate(base.getDate() + days);
        await supabaseAdmin.from("projects").update({
          expiry_date: base.toISOString().split("T")[0],
          subscription_status: "active",
        }).eq("id", projectId);
        return json({ success: true });
      }

      if (action === "suspend_project") {
        const { projectId } = body;
        if (!projectId) return json({ error: "projectId required" }, 400);
        await supabaseAdmin.from("projects").update({
          subscription_status: "suspended",
          is_active: false,
        }).eq("id", projectId);
        return json({ success: true });
      }

      if (action === "reactivate_project") {
        const { projectId } = body;
        if (!projectId) return json({ error: "projectId required" }, 400);
        await supabaseAdmin.from("projects").update({
          subscription_status: "active",
          is_active: true,
        }).eq("id", projectId);
        return json({ success: true });
      }

      if (action === "dashboard_stats") {
        // Fetch all projects to compute expiring count
        const { data: allProjectsList } = await supabaseAdmin.from("projects").select("id, expiry_date, subscription_status, is_active, created_at");
        const now = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

        let totalProjects = 0, activeProjects = 0, expiringProjects = 0, suspendedProjects = 0;
        (allProjectsList || []).forEach((p: any) => {
          totalProjects++;
          if (p.subscription_status === "suspended" || !p.is_active) {
            suspendedProjects++;
          } else if (p.expiry_date) {
            const diff = new Date(p.expiry_date).getTime() - now;
            if (diff <= 0) {
              // expired
            } else if (diff <= threeDaysMs) {
              expiringProjects++;
              activeProjects++;
            } else {
              activeProjects++;
            }
          } else {
            activeProjects++;
          }
        });

        const [
          { count: pendingRequests },
          { count: totalUsers },
          { count: totalOrders },
        ] = await Promise.all([
          supabaseAdmin.from("project_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
          supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).neq("role", "owner"),
          supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("is_deleted", false),
        ]);

        // Chart data: last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const { data: recentOrders } = await supabaseAdmin.from("orders")
          .select("created_at")
          .eq("is_deleted", false)
          .gte("created_at", sixMonthsAgo.toISOString());

        const ordersByMonth: Record<string, number> = {};
        (recentOrders || []).forEach((o: any) => {
          const d = new Date(o.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          ordersByMonth[key] = (ordersByMonth[key] || 0) + 1;
        });

        const projectsByMonth: Record<string, number> = {};
        (allProjectsList || []).forEach((p: any) => {
          const d = new Date(p.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          projectsByMonth[key] = (projectsByMonth[key] || 0) + 1;
        });

        // Active users per month (from login timestamps)
        const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers();
        const usersByMonth: Record<string, number> = {};
        (allUsers || []).forEach((u: any) => {
          if (u.last_sign_in_at) {
            const d = new Date(u.last_sign_in_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            usersByMonth[key] = (usersByMonth[key] || 0) + 1;
          }
        });

        const chartData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const monthName = d.toLocaleString('en', { month: 'short' });
          chartData.push({
            month: monthName,
            orders: ordersByMonth[key] || 0,
            projects: projectsByMonth[key] || 0,
            users: usersByMonth[key] || 0,
          });
        }

        return json({
          totalProjects,
          pendingRequests: pendingRequests || 0,
          activeProjects,
          expiringProjects,
          suspendedProjects,
          totalUsers: totalUsers || 0,
          totalOrders: totalOrders || 0,
          chartData,
        });
      }

      // ---- OWNER: ALL USERS MANAGEMENT ----
      if (action === "owner_list_users") {
        const { projectId } = body;
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) return json({ error: error.message }, 400);

        const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
        const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
        const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, full_name, project_id, phone");
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const { data: allProjects } = await supabaseAdmin.from("projects").select("id, business_name");
        const projMap = new Map((allProjects || []).map((p: any) => [p.id, p.business_name]));

        const result = users
          .filter((u: any) => {
            const userRole = roleMap.get(u.id);
            if (userRole === "owner") return false;
            if (projectId) {
              const prof = profileMap.get(u.id);
              return prof?.project_id === projectId;
            }
            return true;
          })
          .map((u: any) => {
            const prof = profileMap.get(u.id);
            return {
              id: u.id,
              email: u.email,
              fullName: prof?.full_name || u.user_metadata?.full_name || "",
              phone: prof?.phone || "",
              role: roleMap.get(u.id) || null,
              projectId: prof?.project_id || null,
              projectName: prof?.project_id ? projMap.get(prof.project_id) || "Unknown" : "Unassigned",
              createdAt: u.created_at,
              lastSignIn: u.last_sign_in_at,
              emailConfirmed: !!u.email_confirmed_at,
              banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
            };
          });
        return json({ users: result });
      }

      if (action === "owner_create_user") {
        const { email, password, fullName, role, projectId } = body;
        if (!email || !password || !role) return json({ error: "email, password, and role are required" }, 400);

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: fullName || "" },
        });
        if (createError) return json({ error: createError.message }, 400);

        await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
        if (projectId) {
          await supabaseAdmin.from("profiles").update({ project_id: projectId }).eq("user_id", newUser.user.id);
        }
        return json({ success: true, userId: newUser.user.id });
      }

      if (action === "owner_update_user") {
        const { userId, fullName, email, phone } = body;
        if (!userId) return json({ error: "userId required" }, 400);
        const updates: any = {};
        if (email) updates.email = email;
        if (fullName !== undefined) updates.user_metadata = { full_name: fullName };
        if (Object.keys(updates).length > 0) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
          if (error) return json({ error: error.message }, 400);
        }
        const profileUpdates: any = {};
        if (fullName !== undefined) profileUpdates.full_name = fullName;
        if (phone !== undefined) profileUpdates.phone = phone;
        if (Object.keys(profileUpdates).length > 0) {
          await supabaseAdmin.from("profiles").update(profileUpdates).eq("user_id", userId);
        }
        return json({ success: true });
      }

      if (action === "owner_update_role") {
        const { userId, role } = body;
        if (!userId || !role) return json({ error: "userId and role required" }, 400);
        const { data: existingRole } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", userId).maybeSingle();
        if (existingRole) {
          await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", userId);
        } else {
          await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
        }
        return json({ success: true });
      }

      if (action === "owner_reset_password") {
        const { userId, newPassword } = body;
        if (!userId || !newPassword) return json({ error: "userId and newPassword required" }, 400);
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      if (action === "owner_toggle_ban") {
        const { userId, ban } = body;
        if (!userId) return json({ error: "userId required" }, 400);
        const banData = ban ? { ban_duration: "876600h" } : { ban_duration: "none" };
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, banData as any);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      if (action === "owner_delete_user") {
        const { userId } = body;
        if (!userId) return json({ error: "userId required" }, 400);
        await supabaseAdmin.from("orders").update({ assigned_to: null, assigned_to_name: "" }).eq("assigned_to", userId);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      if (action === "owner_transfer_admin") {
        const { projectId, newAdminUserId } = body;
        if (!projectId || !newAdminUserId) return json({ error: "projectId and newAdminUserId required" }, 400);
        const { data: project } = await supabaseAdmin.from("projects").select("owner_user_id").eq("id", projectId).single();
        if (!project) return json({ error: "Project not found" }, 404);
        await supabaseAdmin.from("user_roles").update({ role: "sub_admin" }).eq("user_id", project.owner_user_id);
        await supabaseAdmin.from("user_roles").update({ role: "admin" }).eq("user_id", newAdminUserId);
        await supabaseAdmin.from("projects").update({ owner_user_id: newAdminUserId }).eq("id", projectId);
        return json({ success: true });
      }

      // ---- OWNER: CHECK SUBSCRIPTION STATUS ----
      if (action === "check_project_subscription") {
        const { projectId } = body;
        if (!projectId) return json({ error: "projectId required" }, 400);
        const { data: project } = await supabaseAdmin.from("projects").select("expiry_date, subscription_status, is_active").eq("id", projectId).single();
        if (!project) return json({ error: "Project not found" }, 404);
        return json({ subscription: project });
      }

      // ---- OWNER: SYSTEM LOGS ----
      if (action === "owner_system_logs") {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const userMap = new Map((users || []).map((u: any) => [u.id, { email: u.email, name: u.user_metadata?.full_name || u.email }]));
        
        const logs: any[] = [];
        
        const { data: recentOrders } = await supabaseAdmin.from("orders")
          .select("id, customer_name, created_at, created_by, updated_at, current_status, project_id")
          .order("updated_at", { ascending: false })
          .limit(50);
        
        (recentOrders || []).forEach((o: any) => {
          const user = userMap.get(o.created_by);
          logs.push({
            id: `order-${o.id}`,
            type: "order",
            action: `Order for ${o.customer_name} (${o.current_status})`,
            userId: o.created_by,
            userName: user?.name || "System",
            userEmail: user?.email || "",
            projectId: o.project_id,
            timestamp: o.updated_at,
          });
        });

        const { data: recentProjects } = await supabaseAdmin.from("projects")
          .select("id, business_name, created_at, updated_at")
          .order("updated_at", { ascending: false })
          .limit(20);
        
        (recentProjects || []).forEach((p: any) => {
          logs.push({
            id: `project-${p.id}`,
            type: "project",
            action: `Project "${p.business_name}"`,
            userId: null,
            userName: "System",
            userEmail: "",
            projectId: p.id,
            timestamp: p.updated_at,
          });
        });

        (users || []).filter((u: any) => u.last_sign_in_at).forEach((u: any) => {
          logs.push({
            id: `login-${u.id}`,
            type: "login",
            action: `User login`,
            userId: u.id,
            userName: u.user_metadata?.full_name || u.email,
            userEmail: u.email,
            projectId: null,
            timestamp: u.last_sign_in_at,
          });
        });

        const { data: roleChanges } = await supabaseAdmin.from("user_roles")
          .select("user_id, role, created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        
        (roleChanges || []).forEach((r: any) => {
          const user = userMap.get(r.user_id);
          logs.push({
            id: `role-${r.user_id}-${r.created_at}`,
            type: "role",
            action: `Role assigned: ${r.role}`,
            userId: r.user_id,
            userName: user?.name || "Unknown",
            userEmail: user?.email || "",
            projectId: null,
            timestamp: r.created_at,
          });
        });

        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return json({ logs: logs.slice(0, 100) });
      }

      return json({ error: "Unknown action" }, 400);
    }

    // ============ ADMIN ACTIONS ============
    if (callerRole !== "admin") return json({ error: "Forbidden: Admin only" }, 403);

    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("project_id").eq("user_id", caller.id).maybeSingle();
    const callerProjectId = callerProfile?.project_id;

    if (action === "create") {
      const { email, password, fullName, role } = body;
      if (!email || !password || !role) return json({ error: "email, password, and role are required" }, 400);
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName || "" },
      });
      if (createError) return json({ error: createError.message }, 400);
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
      if (roleError) return json({ error: roleError.message }, 400);
      if (callerProjectId) {
        await supabaseAdmin.from("profiles").update({ project_id: callerProjectId }).eq("user_id", newUser.user.id);
      }
      return json({ success: true, userId: newUser.user.id });
    }

    if (action === "reset_password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) return json({ error: "userId and newPassword required" }, 400);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
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
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
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
      const result = users
        .filter((u: any) => {
          const prof = profileMap.get(u.id);
          const userRole = roleMap.get(u.id);
          if (userRole === "owner") return false;
          if (!callerProjectId) return true;
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
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, banData as any);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete_user") {
      const { userId } = body;
      if (!userId) return json({ error: "userId required" }, 400);
      if (userId === caller.id) return json({ error: "Cannot delete yourself" }, 400);

      await supabaseAdmin.from("orders").update({ assigned_to: null, assigned_to_name: "" }).eq("assigned_to", userId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delError) return json({ error: delError.message }, 400);

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
