import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HASAN_ID = "59b0b319-336b-4dac-8f6b-ee82ffabeea5";
const KAJAL_ID = "6471e991-5f50-4a01-801b-00b242129f2e";
const PEYARUL_ID = "51d4b678-c928-40a0-8bd9-e3f145dd0be0";
const ADMIN_ID = "a795cb65-fd52-4c54-95aa-6ca2f840217e";

const PRODUCTS = [
  { id: "11ef1144-224d-4560-86a7-cb26c7ab34ef", sku: "SG-15", price: 990, title: "ShaktiGuard-ট্রায়াল প্যাকেজ (১৫ দিনের)" },
  { id: "65b05bc9-86f7-4bf3-b28d-a2ce8e607431", sku: "SG-30", price: 1590, title: "ShaktiGuard ১ মাসের প্যাকেজ।" },
  { id: "5b14b047-15ba-4679-9947-ae204a192bcf", sku: "LG-15", price: 930, title: "LeukoGuard" },
  { id: "eb7b8c38-445f-40b8-82f6-577b639a917a", sku: "AL-13", price: 900, title: "আল আমিন" },
  { id: "3cb69630-a4a6-4f99-ae10-694de0ca9a1b", sku: "DC-30", price: 1200, title: "DiabaCare Plus" },
];

const DELIVERY_METHOD = "ded04f1a-f52d-497d-bff2-0e24e01721dc";
const ORDER_SOURCES = ["Website", "Phone Call", "Referral", "Messenger", "WhatsApp", "Comment", "FB Group", "Followup"];

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
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}
function isoStr(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (roleData?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action } = await req.json();

    if (action === "seed") {
      // Step 1: Batch create customers
      const customerIds: Record<string, string> = {};
      for (const c of CUSTOMERS) {
        const { data } = await supabase.rpc("find_or_create_customer", { p_name: c.name, p_mobile: c.mobile, p_address: c.address });
        customerIds[c.mobile] = data as string;
      }

      // Step 2: Build all order rows — insert ONE AT A TIME to let trigger generate SKU IDs sequentially
      const execs = [
        { id: HASAN_ID, name: "Hasan" },
        { id: KAJAL_ID, name: "Kajal" },
        { id: PEYARUL_ID, name: "Peyarul" },
      ];
      const execLimits = [40, 40, 30];
      const execCounts = [0, 0, 0];

      function getExec(): { id: string | null; name: string } {
        for (let i = 0; i < 3; i++) {
          if (execCounts[i] < execLimits[i]) { execCounts[i]++; return { id: execs[i].id, name: execs[i].name }; }
        }
        return { id: null, name: "" }; // unassigned
      }

      interface ODef { step: number; status: string; health: string; custIdx: number; prodIdx: number; daysAgo: number; }
      const defs: ODef[] = [];
      let ci = 0;
      // 40 S1P
      for (let i = 0; i < 40; i++) { defs.push({ step: 1, status: "pending", health: "new", custIdx: ci++ % 50, prodIdx: i % 5, daysAgo: 1 + (i % 15) }); }
      // 20 S1C
      for (let i = 0; i < 20; i++) { defs.push({ step: 1, status: "completed", health: "good", custIdx: ci++ % 50, prodIdx: i % 5, daysAgo: 10 + (i % 10) }); }
      // 20 S2P
      for (let i = 0; i < 20; i++) { defs.push({ step: 2, status: "pending", health: "good", custIdx: ci++ % 50, prodIdx: i % 5, daysAgo: 15 + (i % 10) }); }
      // 15 S3P
      for (let i = 0; i < 15; i++) { defs.push({ step: 3, status: "pending", health: "good", custIdx: ci++ % 50, prodIdx: i % 5, daysAgo: 20 + (i % 10) }); }
      // 10 S4P
      for (let i = 0; i < 10; i++) { defs.push({ step: 4, status: "pending", health: "good", custIdx: (20 + i) % 50, prodIdx: i % 5, daysAgo: 30 + (i % 5) }); }
      // 5 S5C
      for (let i = 0; i < 5; i++) { defs.push({ step: 5, status: "completed", health: "good", custIdx: (30 + i) % 50, prodIdx: i % 5, daysAgo: 40 + i }); }

      // Insert orders one by one (trigger needs sequential access)
      const orderIds: string[] = [];
      const orderExecs: { id: string | null; name: string }[] = [];
      for (let i = 0; i < defs.length; i++) {
        const d = defs[i];
        const c = CUSTOMERS[d.custIdx];
        const p = PRODUCTS[d.prodIdx];
        const ex = getExec();
        orderExecs.push(ex);
        const followupDate = d.status === "completed" ? null : dateStr(Math.max(0, d.daysAgo - 3));

        const { data, error } = await supabase.from("orders").insert({
          customer_name: c.name, mobile: c.mobile, address: c.address,
          order_source: pickRandom(ORDER_SOURCES),
          product_id: p.id, product_title: p.title, price: p.price,
          followup_step: d.step, current_status: d.status,
          followup_date: followupDate,
          assigned_to: ex.id, assigned_to_name: ex.name,
          order_date: dateStr(d.daysAgo), delivery_date: dateStr(Math.max(0, d.daysAgo - 3)),
          delivery_method: DELIVERY_METHOD, health: d.health,
          customer_id: customerIds[c.mobile], created_by: ADMIN_ID,
          is_repeat: false, is_upsell: false, note: "",
        }).select("id").single();

        if (error) { console.error("Err:", error.message); orderIds.push(""); }
        else { orderIds.push(data.id); }
      }

      // Step 3: Batch insert followup history
      const historyRows: any[] = [];
      for (let i = 0; i < defs.length; i++) {
        const d = defs[i];
        const oid = orderIds[i];
        if (!oid) continue;
        const ex = orderExecs[i];
        const stepsToCreate = d.status === "completed" ? d.step : d.step - 1;
        for (let s = 1; s <= stepsToCreate; s++) {
          historyRows.push({
            order_id: oid, step_number: s,
            note: `Step ${s} followup completed.`,
            problems_discussed: s > 1 ? "Customer had questions about usage." : "",
            upsell_attempted: false, upsell_details: "",
            next_followup_date: s < 5 ? dateStr(d.daysAgo - s * 3) : null,
            completed_by: ex.id || ADMIN_ID,
            completed_by_name: ex.name || "Admin",
            completed_at: isoStr(d.daysAgo - (s - 1) * 3),
          });
        }
      }
      // Insert in batches of 50
      for (let b = 0; b < historyRows.length; b += 50) {
        const batch = historyRows.slice(b, b + 50);
        const { error } = await supabase.from("followup_history").insert(batch);
        if (error) console.error("History batch err:", error.message);
      }

      // Step 4: Insert 10 repeat orders
      const parentIndices = [40, 41, 42, 43, 44, 60, 61, 62, 63, 64];
      const repeatIds: string[] = [];
      for (let r = 0; r < 10; r++) {
        const parentId = orderIds[parentIndices[r]];
        if (!parentId) continue;
        const c = CUSTOMERS[10 + r];
        const p = PRODUCTS[r % 5];
        const ex = execs[r % 3];
        const { data, error } = await supabase.from("orders").insert({
          customer_name: c.name, mobile: c.mobile, address: c.address,
          order_source: "Followup", product_id: p.id, product_title: p.title, price: p.price,
          followup_step: 1, current_status: "pending", followup_date: dateStr(0),
          assigned_to: ex.id, assigned_to_name: ex.name,
          order_date: dateStr(2), delivery_date: dateStr(0),
          delivery_method: DELIVERY_METHOD, health: "good",
          customer_id: customerIds[c.mobile], created_by: ADMIN_ID,
          parent_order_id: parentId, is_repeat: true, is_upsell: false,
          note: "Repeat order from followup",
        }).select("id").single();
        if (data) repeatIds.push(data.id); else if (error) console.error("Repeat err:", error.message);
      }

      // Step 5: Upsell records — get followup history IDs for first 15 completed orders
      const upsellCandidates = defs.map((d, i) => ({ i, d })).filter(x => (x.d.status === "completed" || x.d.step > 1) && orderIds[x.i]).slice(0, 15);
      const upsellOrderIds = upsellCandidates.map(x => orderIds[x.i]);
      const { data: allHistories } = await supabase.from("followup_history").select("id, order_id").in("order_id", upsellOrderIds).order("step_number", { ascending: true });

      const orderHistoryMap: Record<string, string> = {};
      for (const h of allHistories || []) {
        if (!orderHistoryMap[h.order_id]) orderHistoryMap[h.order_id] = h.id;
      }

      const upsellRows: any[] = [];
      for (let idx = 0; idx < upsellCandidates.length; idx++) {
        const oid = orderIds[upsellCandidates[idx].i];
        const fid = orderHistoryMap[oid];
        if (!fid) continue;
        const up = PRODUCTS[(idx + 1) % 5];
        upsellRows.push({ followup_id: fid, product_id: up.id, product_name: up.title, price: up.price, note: "Customer interested", added_by: orderExecs[upsellCandidates[idx].i].id || ADMIN_ID });
        if (idx % 3 === 0) {
          const up2 = PRODUCTS[(idx + 2) % 5];
          upsellRows.push({ followup_id: fid, product_id: up2.id, product_name: up2.title, price: up2.price, note: "Second upsell", added_by: orderExecs[upsellCandidates[idx].i].id || ADMIN_ID });
        }
      }
      if (upsellRows.length > 0) {
        const { error } = await supabase.from("upsell_records").insert(upsellRows);
        if (error) console.error("Upsell err:", error.message);
      }

      // Step 6: Repeat order records
      const repeatRecordRows: any[] = [];
      for (let r = 0; r < repeatIds.length; r++) {
        const parentId = orderIds[parentIndices[r]];
        const fid = orderHistoryMap[parentId];
        if (!fid) continue;
        const p = PRODUCTS[r % 5];
        repeatRecordRows.push({ followup_id: fid, product_id: p.id, product_name: p.title, price: p.price, child_order_id: repeatIds[r], note: "Repeat from followup", added_by: execs[r % 3].id });
      }
      if (repeatRecordRows.length > 0) {
        const { error } = await supabase.from("repeat_order_records").insert(repeatRecordRows);
        if (error) console.error("Repeat record err:", error.message);
      }

      return new Response(JSON.stringify({
        success: true,
        summary: { customers: Object.keys(customerIds).length, baseOrders: orderIds.filter(Boolean).length, repeatOrders: repeatIds.length, totalOrders: orderIds.filter(Boolean).length + repeatIds.length, upsellRecords: upsellRows.length },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cleanup") {
      const demoMobiles = CUSTOMERS.map(c => c.mobile);
      const { data: demoOrders } = await supabase.from("orders").select("id").in("mobile", demoMobiles);
      if (demoOrders && demoOrders.length > 0) {
        const oids = demoOrders.map(o => o.id);
        const { data: hists } = await supabase.from("followup_history").select("id").in("order_id", oids);
        const hids = hists?.map((h: any) => h.id) || [];
        if (hids.length) {
          await supabase.from("upsell_records").delete().in("followup_id", hids);
          await supabase.from("repeat_order_records").delete().in("followup_id", hids);
        }
        await supabase.from("followup_history").delete().in("order_id", oids);
        await supabase.from("orders").delete().in("id", oids);
      }
      await supabase.from("customers").delete().in("mobile_number", demoMobiles);
      return new Response(JSON.stringify({ success: true, message: "Cleaned up" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Use 'seed' or 'cleanup'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
