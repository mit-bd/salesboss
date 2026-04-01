import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Advance followup steps
    const { data, error } = await supabase.rpc("advance_followup_steps");

    if (error) {
      console.error("Error advancing followup steps:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Advanced ${data} orders to next followup step`);

    // 2. Create notifications for orders that just became pending
    if (data > 0) {
      const { data: advancedOrders, error: fetchError } = await supabase
        .from("orders")
        .select("id, invoice_id, customer_name, followup_step, assigned_to, project_id")
        .eq("current_status", "pending")
        .eq("is_deleted", false)
        .gte("updated_at", new Date(Date.now() - 2 * 60 * 1000).toISOString());

      if (!fetchError && advancedOrders && advancedOrders.length > 0) {
        const notifications: any[] = [];

        for (const order of advancedOrders) {
          if (order.assigned_to) {
            notifications.push({
              user_id: order.assigned_to,
              project_id: order.project_id,
              type: "followup_due",
              title: "Followup Due",
              message: `Followup Step ${order.followup_step} due for ${order.customer_name} (${order.invoice_id})`,
              order_id: order.id,
            });
          }

          if (order.project_id) {
            const { data: adminProfiles } = await supabase
              .from("profiles")
              .select("user_id")
              .eq("project_id", order.project_id);

            if (adminProfiles) {
              for (const profile of adminProfiles) {
                const { data: isAdmin } = await supabase.rpc("has_role", {
                  _user_id: profile.user_id,
                  _role: "admin",
                });
                if (isAdmin && profile.user_id !== order.assigned_to) {
                  notifications.push({
                    user_id: profile.user_id,
                    project_id: order.project_id,
                    type: "followup_due",
                    title: "Followup Due",
                    message: `Followup Step ${order.followup_step} due for ${order.customer_name} (${order.invoice_id})`,
                    order_id: order.id,
                  });
                }
              }
            }
          }
        }

        if (notifications.length > 0) {
          const { error: notifError } = await supabase.from("notifications").insert(notifications);
          if (notifError) {
            console.error("Error creating notifications:", notifError);
          } else {
            console.log(`Created ${notifications.length} followup notifications`);
          }
        }
      }
    }

    // 3. Time-based reminders: Check for followups due within 10 minutes
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

    const { data: upcomingOrders, error: upcomingError } = await supabase
      .from("orders")
      .select("id, invoice_id, customer_name, followup_step, assigned_to, project_id, next_followup_datetime")
      .eq("current_status", "pending")
      .eq("is_deleted", false)
      .not("next_followup_datetime", "is", null)
      .lte("next_followup_datetime", tenMinutesFromNow.toISOString())
      .gte("next_followup_datetime", now.toISOString());

    if (!upcomingError && upcomingOrders && upcomingOrders.length > 0) {
      const reminderNotifs: any[] = [];

      for (const order of upcomingOrders) {
        const followupTime = new Date(order.next_followup_datetime);
        const minutesLeft = Math.round((followupTime.getTime() - now.getTime()) / 60000);
        const timeStr = followupTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

        // Check if reminder already sent (within last 15 min for this order)
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("order_id", order.id)
          .eq("type", "followup_reminder")
          .gte("created_at", new Date(now.getTime() - 15 * 60 * 1000).toISOString())
          .limit(1);

        if (existingNotif && existingNotif.length > 0) continue;

        const message = minutesLeft <= 1
          ? `📞 Call ${order.customer_name} NOW — Followup Step ${order.followup_step} (${order.invoice_id})`
          : `⏰ Followup in ${minutesLeft} min — ${order.customer_name} at ${timeStr} (${order.invoice_id})`;

        if (order.assigned_to) {
          reminderNotifs.push({
            user_id: order.assigned_to,
            project_id: order.project_id,
            type: "followup_reminder",
            title: minutesLeft <= 1 ? "Call Now" : "Upcoming Followup",
            message,
            order_id: order.id,
          });
        }
      }

      if (reminderNotifs.length > 0) {
        const { error: reminderError } = await supabase.from("notifications").insert(reminderNotifs);
        if (reminderError) {
          console.error("Error creating reminder notifications:", reminderError);
        } else {
          console.log(`Created ${reminderNotifs.length} reminder notifications`);
        }
      }
    }

    // 4. Check for exact-time followups (due right now or past due within 5 min)
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const { data: dueNowOrders, error: dueNowError } = await supabase
      .from("orders")
      .select("id, invoice_id, customer_name, followup_step, assigned_to, project_id, next_followup_datetime")
      .eq("current_status", "pending")
      .eq("is_deleted", false)
      .not("next_followup_datetime", "is", null)
      .lte("next_followup_datetime", now.toISOString())
      .gte("next_followup_datetime", fiveMinAgo.toISOString());

    if (!dueNowError && dueNowOrders && dueNowOrders.length > 0) {
      const dueNotifs: any[] = [];

      for (const order of dueNowOrders) {
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("order_id", order.id)
          .eq("type", "followup_now")
          .gte("created_at", fiveMinAgo.toISOString())
          .limit(1);

        if (existingNotif && existingNotif.length > 0) continue;

        if (order.assigned_to) {
          dueNotifs.push({
            user_id: order.assigned_to,
            project_id: order.project_id,
            type: "followup_now",
            title: "Call Customer Now",
            message: `📞 Followup Step ${order.followup_step} for ${order.customer_name} is due NOW (${order.invoice_id})`,
            order_id: order.id,
          });
        }
      }

      if (dueNotifs.length > 0) {
        const { error: dueError } = await supabase.from("notifications").insert(dueNotifs);
        if (dueError) {
          console.error("Error creating due-now notifications:", dueError);
        } else {
          console.log(`Created ${dueNotifs.length} due-now notifications`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, advancedCount: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
