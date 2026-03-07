import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    // 2. Create notifications for orders that just became pending (recently advanced)
    if (data > 0) {
      // Find orders that were just advanced (updated_at within last 2 minutes, status pending)
      const { data: advancedOrders, error: fetchError } = await supabase
        .from("orders")
        .select("id, invoice_id, customer_name, followup_step, assigned_to, project_id")
        .eq("current_status", "pending")
        .eq("is_deleted", false)
        .gte("updated_at", new Date(Date.now() - 2 * 60 * 1000).toISOString());

      if (!fetchError && advancedOrders && advancedOrders.length > 0) {
        const notifications: any[] = [];

        for (const order of advancedOrders) {
          // Notify assigned sales executive
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

          // Notify admins in the same project
          if (order.project_id) {
            const { data: adminProfiles } = await supabase
              .from("profiles")
              .select("user_id")
              .eq("project_id", order.project_id);

            if (adminProfiles) {
              for (const profile of adminProfiles) {
                // Check if this user is admin
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
          const { error: notifError } = await supabase
            .from("notifications")
            .insert(notifications);
          if (notifError) {
            console.error("Error creating notifications:", notifError);
          } else {
            console.log(`Created ${notifications.length} followup notifications`);
          }
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
