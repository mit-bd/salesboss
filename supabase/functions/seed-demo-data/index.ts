import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Sales executive user IDs ──
const HASAN_ID = "59b0b319-336b-4dac-8f6b-ee82ffabeea5";
const KAJAL_ID = "6471e991-5f50-4a01-801b-00b242129f2e";
const PEYARUL_ID = "51d4b678-c928-40a0-8bd9-e3f145dd0be0";
const ADMIN_ID = "a795cb65-fd52-4c54-95aa-6ca2f840217e";

// ── Products ──
const PRODUCTS = [
  { id: "11ef1144-224d-4560-86a7-cb26c7ab34ef", sku: "SG-15", price: 990, title: "ShaktiGuard-ট্রায়াল প্যাকেজ (১৫ দিনের)" },
  { id: "65b05bc9-86f7-4bf3-b28d-a2ce8e607431", sku: "SG-30", price: 1590, title: "ShaktiGuard ১ মাসের প্যাকেজ।" },
  { id: "5b14b047-15ba-4679-9947-ae204a192bcf", sku: "LG-15", price: 930, title: "LeukoGuard" },
  { id: "eb7b8c38-445f-40b8-82f6-577b639a917a", sku: "AL-13", price: 900, title: "আল আমিন" },
  { id: "3cb69630-a4a6-4f99-ae10-694de0ca9a1b", sku: "DC-30", price: 1200, title: "DiabaCare Plus" },
];

const DELIVERY_METHOD = "ded04f1a-f52d-497d-bff2-0e24e01721dc"; // SteadFast

const ORDER_SOURCES = [
  "Website", "Phone Call", "Referral", "Messenger", "WhatsApp", "Comment", "FB Group", "Followup"
];

// ── 50 Bangladeshi customer names ──
const CUSTOMERS = [
  { name: "আরিফুল ইসলাম", mobile: "01711000101", address: "মিরপুর-১০, ঢাকা" },
  { name: "রহিমা বেগম", mobile: "01711000102", address: "উত্তরা সেক্টর-৭, ঢাকা" },
  { name: "মোঃ কামরুল হাসান", mobile: "01711000103", address: "ধানমন্ডি ৩২, ঢাকা" },
  { name: "ফারজানা আক্তার", mobile: "01711000104", address: "বনানী ১১, ঢাকা" },
  { name: "শাহিন আলম", mobile: "01711000105", address: "মোহাম্মদপুর, ঢাকা" },
  { name: "নাজমুল হক", mobile: "01711000106", address: "গুলশান-২, ঢাকা" },
  { name: "সুমাইয়া খাতুন", mobile: "01711000107", address: "বাড্ডা, ঢাকা" },
  { name: "তানভীর আহমেদ", mobile: "01711000108", address: "রামপুরা, ঢাকা" },
  { name: "রোকেয়া সুলতানা", mobile: "01711000109", address: "তেজগাঁও, ঢাকা" },
  { name: "মোঃ জাহিদুল ইসলাম", mobile: "01711000110", address: "কল্যাণপুর, ঢাকা" },
  // Repeat customers (will have 2-3 orders) — indices 10-19
  { name: "আবু সাঈদ", mobile: "01711000111", address: "আগারগাঁও, ঢাকা" },
  { name: "শামীমা নাসরিন", mobile: "01711000112", address: "শ্যামলী, ঢাকা" },
  { name: "মোঃ রাসেল মিয়া", mobile: "01711000113", address: "যাত্রাবাড়ী, ঢাকা" },
  { name: "নুসরাত জাহান", mobile: "01711000114", address: "খিলগাঁও, ঢাকা" },
  { name: "ইমরান হোসেন", mobile: "01711000115", address: "মিরপুর-১২, ঢাকা" },
  { name: "মাহমুদা আক্তার", mobile: "01711000116", address: "উত্তরা সেক্টর-৩, ঢাকা" },
  { name: "সাইফুল ইসলাম", mobile: "01711000117", address: "পল্লবী, ঢাকা" },
  { name: "তাসলিমা আক্তার", mobile: "01711000118", address: "কাফরুল, ঢাকা" },
  { name: "আব্দুর রহমান", mobile: "01711000119", address: "বসুন্ধরা, ঢাকা" },
  { name: "সালমা বেগম", mobile: "01711000120", address: "নিকুঞ্জ, ঢাকা" },
  // Regular customers 20-49
  { name: "জহিরুল ইসলাম", mobile: "01711000121", address: "চট্টগ্রাম সদর" },
  { name: "আমেনা খাতুন", mobile: "01711000122", address: "নারায়ণগঞ্জ সদর" },
  { name: "মোঃ ফারুক আহমেদ", mobile: "01711000123", address: "গাজীপুর সদর" },
  { name: "রুবিনা ইয়াসমিন", mobile: "01711000124", address: "কুমিল্লা সদর" },
  { name: "মোঃ শফিকুল ইসলাম", mobile: "01711000125", address: "রাজশাহী সদর" },
  { name: "মোসাম্মৎ রেহেনা", mobile: "01711000126", address: "সিলেট সদর" },
  { name: "আনোয়ার হোসেন", mobile: "01711000127", address: "রংপুর সদর" },
  { name: "হালিমা বেগম", mobile: "01711000128", address: "খুলনা সদর" },
  { name: "মোঃ তৌফিকুল ইসলাম", mobile: "01711000129", address: "বরিশাল সদর" },
  { name: "আফরোজা পারভীন", mobile: "01711000130", address: "ময়মনসিংহ সদর" },
  { name: "মোঃ হাবিবুর রহমান", mobile: "01711000131", address: "টাঙ্গাইল সদর" },
  { name: "নাসরিন সুলতানা", mobile: "01711000132", address: "ফরিদপুর সদর" },
  { name: "মোঃ আলাউদ্দিন", mobile: "01711000133", address: "পাবনা সদর" },
  { name: "সাবিনা ইয়াসমিন", mobile: "01711000134", address: "যশোর সদর" },
  { name: "মোঃ নজরুল ইসলাম", mobile: "01711000135", address: "দিনাজপুর সদর" },
  { name: "মারুফা আক্তার", mobile: "01711000136", address: "বগুড়া সদর" },
  { name: "মোঃ আশরাফুল আলম", mobile: "01711000137", address: "নোয়াখালী সদর" },
  { name: "শাহনাজ পারভীন", mobile: "01711000138", address: "ব্রাহ্মণবাড়িয়া সদর" },
  { name: "মোঃ মোস্তাফিজুর রহমান", mobile: "01711000139", address: "কিশোরগঞ্জ সদর" },
  { name: "জান্নাতুল ফেরদৌস", mobile: "01711000140", address: "মাদারীপুর সদর" },
  { name: "মোঃ দেলোয়ার হোসেন", mobile: "01711000141", address: "জামালপুর সদর" },
  { name: "খাদিজা আক্তার", mobile: "01711000142", address: "নেত্রকোনা সদর" },
  { name: "মোঃ সোহেল রানা", mobile: "01711000143", address: "হবিগঞ্জ সদর" },
  { name: "রুমানা পারভীন", mobile: "01711000144", address: "মৌলভীবাজার সদর" },
  { name: "মোঃ আকবর আলী", mobile: "01711000145", address: "সুনামগঞ্জ সদর" },
  { name: "ফাহমিদা রহমান", mobile: "01711000146", address: "শেরপুর সদর" },
  { name: "মোঃ সাজ্জাদ হোসেন", mobile: "01711000147", address: "নরসিংদী সদর" },
  { name: "শিরিন আক্তার", mobile: "01711000148", address: "মুন্সিগঞ্জ সদর" },
  { name: "মোঃ ইব্রাহিম খলিল", mobile: "01711000149", address: "মানিকগঞ্জ সদর" },
  { name: "লাকী বেগম", mobile: "01711000150", address: "গোপালগঞ্জ সদর" },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function isoStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "seed") {
      // ─── Step 1: Create customers ───
      const customerIds: Record<string, string> = {};
      for (const c of CUSTOMERS) {
        const { data } = await supabase.rpc("find_or_create_customer", {
          p_name: c.name, p_mobile: c.mobile, p_address: c.address,
        });
        customerIds[c.mobile] = data as string;
      }

      // ─── Step 2: Build order list ───
      // Distribution: 40 S1P, 20 S1C, 20 S2P, 15 S3P, 10 S4P, 5 S5C, 10 Repeat = 120
      // Assignment: Hasan 40, Kajal 40, Peyarul 30, Unassigned 10
      const executives = [
        { id: HASAN_ID, name: "Hasan", count: 40 },
        { id: KAJAL_ID, name: "Kajal", count: 40 },
        { id: PEYARUL_ID, name: "Peyarul", count: 30 },
      ];

      interface OrderDef {
        step: number;
        status: string;
        health: string;
        isRepeat: boolean;
        parentIdx?: number; // index into orders array for parent
        custIdx: number;
        prodIdx: number;
        assignedTo: string | null;
        assignedToName: string;
        daysAgo: number;
      }

      const orderDefs: OrderDef[] = [];
      let custCursor = 0;
      let assignIdx = 0; // which exec bucket
      let assignCount = [0, 0, 0]; // current count per exec

      function getNextExec(): { id: string | null; name: string } {
        // Fill Hasan first, then Kajal, then Peyarul, then unassigned
        for (let i = 0; i < 3; i++) {
          if (assignCount[i] < executives[i].count) {
            assignCount[i]++;
            return { id: executives[i].id, name: executives[i].name };
          }
        }
        return { id: null, name: "" };
      }

      // 40 orders → Step 1 Pending
      for (let i = 0; i < 40; i++) {
        const exec = getNextExec();
        orderDefs.push({
          step: 1, status: "pending", health: "new", isRepeat: false,
          custIdx: custCursor % 50, prodIdx: i % 5,
          assignedTo: exec.id, assignedToName: exec.name,
          daysAgo: 1 + (i % 15),
        });
        custCursor++;
      }

      // 20 orders → Step 1 Completed
      for (let i = 0; i < 20; i++) {
        const exec = getNextExec();
        orderDefs.push({
          step: 1, status: "completed", health: "good", isRepeat: false,
          custIdx: custCursor % 50, prodIdx: i % 5,
          assignedTo: exec.id, assignedToName: exec.name,
          daysAgo: 10 + (i % 10),
        });
        custCursor++;
      }

      // 20 orders → Step 2 Pending
      for (let i = 0; i < 20; i++) {
        const exec = getNextExec();
        orderDefs.push({
          step: 2, status: "pending", health: "good", isRepeat: false,
          custIdx: custCursor % 50, prodIdx: i % 5,
          assignedTo: exec.id, assignedToName: exec.name,
          daysAgo: 15 + (i % 10),
        });
        custCursor++;
      }

      // 15 orders → Step 3 Pending
      for (let i = 0; i < 15; i++) {
        const exec = getNextExec();
        orderDefs.push({
          step: 3, status: "pending", health: "good", isRepeat: false,
          custIdx: custCursor % 50, prodIdx: i % 5,
          assignedTo: exec.id, assignedToName: exec.name,
          daysAgo: 20 + (i % 10),
        });
        custCursor++;
      }

      // 10 orders → Step 4 Pending
      for (let i = 0; i < 10; i++) {
        const exec = getNextExec();
        orderDefs.push({
          step: 4, status: "pending", health: "good", isRepeat: false,
          custIdx: (20 + i) % 50, prodIdx: i % 5,
          assignedTo: exec.id, assignedToName: exec.name,
          daysAgo: 30 + (i % 5),
        });
        custCursor++;
      }

      // 5 orders → Step 5 Completed
      for (let i = 0; i < 5; i++) {
        const exec = getNextExec();
        orderDefs.push({
          step: 5, status: "completed", health: "good", isRepeat: false,
          custIdx: (30 + i) % 50, prodIdx: i % 5,
          assignedTo: exec.id, assignedToName: exec.name,
          daysAgo: 40 + i,
        });
        custCursor++;
      }

      // Reserve spots for 10 repeat orders (will be added after parents are inserted)
      // Use repeat customers (index 10-19) as parents
      // Parent orders are some of the S1C/S2P group above

      // ─── Step 3: Insert base orders (110 non-repeat) ───
      const insertedOrderIds: string[] = [];
      for (let i = 0; i < orderDefs.length; i++) {
        const def = orderDefs[i];
        const cust = CUSTOMERS[def.custIdx];
        const prod = PRODUCTS[def.prodIdx];
        const followupDate = def.status === "completed" ? null : dateStr(-1 * (def.daysAgo > 3 ? def.daysAgo - 3 : 0));

        const { data: order, error } = await supabase.from("orders").insert({
          customer_name: cust.name,
          mobile: cust.mobile,
          address: cust.address,
          order_source: pickRandom(ORDER_SOURCES),
          product_id: prod.id,
          product_title: prod.title,
          price: prod.price,
          followup_step: def.step,
          current_status: def.status,
          followup_date: followupDate,
          assigned_to: def.assignedTo,
          assigned_to_name: def.assignedToName,
          order_date: dateStr(def.daysAgo),
          delivery_date: dateStr(def.daysAgo - 3 > 0 ? def.daysAgo - 3 : 0),
          delivery_method: DELIVERY_METHOD,
          health: def.health,
          customer_id: customerIds[cust.mobile],
          created_by: ADMIN_ID,
          is_repeat: false,
          is_upsell: false,
          note: "",
        }).select("id").single();

        if (error) {
          console.error("Order insert error:", error.message);
          insertedOrderIds.push("");
        } else {
          insertedOrderIds.push(order.id);
        }
      }

      // ─── Step 4: Insert followup history for completed steps ───
      // Orders at step N with status pending need history for steps 1..(N-1)
      // Orders at step N with status completed need history for steps 1..N
      for (let i = 0; i < orderDefs.length; i++) {
        const def = orderDefs[i];
        const orderId = insertedOrderIds[i];
        if (!orderId) continue;

        const historySteps = def.status === "completed" ? def.step : def.step - 1;
        for (let s = 1; s <= historySteps; s++) {
          const completedBy = def.assignedTo || ADMIN_ID;
          const completedByName = def.assignedToName || "Admin";
          const nextDate = s < 5 ? dateStr(def.daysAgo - s * 3) : null;

          await supabase.from("followup_history").insert({
            order_id: orderId,
            step_number: s,
            note: `Step ${s} followup completed.`,
            problems_discussed: s > 1 ? "Customer had questions about usage." : "",
            upsell_attempted: false,
            upsell_details: "",
            next_followup_date: nextDate,
            completed_by: completedBy,
            completed_by_name: completedByName,
            completed_at: isoStr(def.daysAgo - (s - 1) * 3),
          });
        }
      }

      // ─── Step 5: Insert 10 repeat orders ───
      // Use repeat customers (indices 10-19) — find their parent orders
      const repeatParentIndices = [40, 41, 42, 43, 44, 60, 61, 62, 63, 64]; // S1C and S2P groups
      const repeatOrderIds: string[] = [];
      for (let r = 0; r < 10; r++) {
        const parentIdx = repeatParentIndices[r % repeatParentIndices.length];
        const parentId = insertedOrderIds[parentIdx];
        if (!parentId) continue;

        const custIdx = 10 + r; // repeat customers
        const cust = CUSTOMERS[custIdx];
        const prod = PRODUCTS[r % 5];
        const exec = executives[r % 3];

        const { data: repOrder } = await supabase.from("orders").insert({
          customer_name: cust.name,
          mobile: cust.mobile,
          address: cust.address,
          order_source: "Followup",
          product_id: prod.id,
          product_title: prod.title,
          price: prod.price,
          followup_step: 1,
          current_status: "pending",
          followup_date: dateStr(0),
          assigned_to: exec.id,
          assigned_to_name: exec.name,
          order_date: dateStr(2),
          delivery_date: dateStr(0),
          delivery_method: DELIVERY_METHOD,
          health: "good",
          customer_id: customerIds[cust.mobile],
          created_by: ADMIN_ID,
          parent_order_id: parentId,
          is_repeat: true,
          is_upsell: false,
          note: "Repeat order from followup",
        }).select("id").single();

        if (repOrder) repeatOrderIds.push(repOrder.id);
      }

      // ─── Step 6: Create followup history entries with upsell data ───
      // Pick 15 completed-step orders for upsell entries
      const upsellOrderIndices: number[] = [];
      for (let i = 0; i < orderDefs.length && upsellOrderIndices.length < 15; i++) {
        const def = orderDefs[i];
        if ((def.status === "completed" || def.step > 1) && insertedOrderIds[i]) {
          upsellOrderIndices.push(i);
        }
      }

      // Get followup_history IDs for these orders to attach upsell records
      for (const idx of upsellOrderIndices) {
        const orderId = insertedOrderIds[idx];
        const { data: histories } = await supabase
          .from("followup_history")
          .select("id, step_number")
          .eq("order_id", orderId)
          .order("step_number", { ascending: true })
          .limit(1);

        if (histories && histories.length > 0) {
          const followupId = histories[0].id;
          const upsellProd = PRODUCTS[(idx + 1) % 5];

          await supabase.from("upsell_records").insert({
            followup_id: followupId,
            product_id: upsellProd.id,
            product_name: upsellProd.title,
            price: upsellProd.price,
            note: "Customer interested in additional product",
            added_by: orderDefs[idx].assignedTo || ADMIN_ID,
          });

          // Some orders get multiple upsell products
          if (idx % 3 === 0) {
            const upsellProd2 = PRODUCTS[(idx + 2) % 5];
            await supabase.from("upsell_records").insert({
              followup_id: followupId,
              product_id: upsellProd2.id,
              product_name: upsellProd2.title,
              price: upsellProd2.price,
              note: "Second upsell product",
              added_by: orderDefs[idx].assignedTo || ADMIN_ID,
            });
          }
        }
      }

      // ─── Step 7: Create repeat_order_records linking to repeat orders ───
      for (let r = 0; r < repeatOrderIds.length; r++) {
        const parentIdx = repeatParentIndices[r % repeatParentIndices.length];
        const parentOrderId = insertedOrderIds[parentIdx];
        if (!parentOrderId) continue;

        const { data: histories } = await supabase
          .from("followup_history")
          .select("id")
          .eq("order_id", parentOrderId)
          .order("step_number", { ascending: false })
          .limit(1);

        if (histories && histories.length > 0) {
          const prod = PRODUCTS[r % 5];
          await supabase.from("repeat_order_records").insert({
            followup_id: histories[0].id,
            product_id: prod.id,
            product_name: prod.title,
            price: prod.price,
            child_order_id: repeatOrderIds[r],
            note: "Repeat order from followup",
            added_by: executives[r % 3].id,
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        summary: {
          customers: Object.keys(customerIds).length,
          baseOrders: insertedOrderIds.filter(Boolean).length,
          repeatOrders: repeatOrderIds.length,
          totalOrders: insertedOrderIds.filter(Boolean).length + repeatOrderIds.length,
          upsellRecords: upsellOrderIndices.length,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cleanup") {
      // Delete all demo data by mobile pattern
      const demoMobiles = CUSTOMERS.map(c => c.mobile);

      // Get order IDs for cleanup
      const { data: demoOrders } = await supabase
        .from("orders")
        .select("id")
        .in("mobile", demoMobiles);

      if (demoOrders && demoOrders.length > 0) {
        const orderIds = demoOrders.map(o => o.id);

        // Delete in dependency order
        await supabase.from("upsell_records").delete().in("followup_id",
          (await supabase.from("followup_history").select("id").in("order_id", orderIds)).data?.map((h: any) => h.id) || []
        );
        await supabase.from("repeat_order_records").delete().in("followup_id",
          (await supabase.from("followup_history").select("id").in("order_id", orderIds)).data?.map((h: any) => h.id) || []
        );
        await supabase.from("followup_history").delete().in("order_id", orderIds);
        await supabase.from("orders").delete().in("id", orderIds);
      }

      // Delete demo customers
      await supabase.from("customers").delete().in("mobile_number", demoMobiles);

      return new Response(JSON.stringify({ success: true, message: "Demo data cleaned up" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'seed' or 'cleanup'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
