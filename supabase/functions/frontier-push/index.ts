import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:frontier@example.com";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function daysBetween(a: string, b: string) {
  const aa = new Date(`${a}T12:00:00-03:00`).getTime();
  const bb = new Date(`${b}T12:00:00-03:00`).getTime();
  return Math.round((bb-aa)/86400000);
}
function payloadRow(row: any) { return row?.payload ? { ...row.payload, id: row.id } : row; }

async function userAlerts(userId: string) {
  const today = localDateKey();
  const [projectsR, financeR, petsR, vehiclesR, calendarR] = await Promise.all([
    supabase.from("projects").select("id,payload").eq("user_id", userId),
    supabase.from("finance_entries").select("id,payload").eq("user_id", userId),
    supabase.from("pets").select("id,payload").eq("user_id", userId),
    supabase.from("vehicles").select("id,payload").eq("user_id", userId),
    supabase.from("calendar_events").select("id,payload").eq("user_id", userId),
  ]);
  const alerts: { icon:string; title:string; date:string; priority:number }[] = [];
  for (const row of projectsR.data || []) {
    const p = payloadRow(row); if (!p.deadline || p.status === "Concluído") continue;
    const d = daysBetween(today, p.deadline);
    if (d >= 0 && d <= 3) alerts.push({icon:"🧭",title:d===0?`Projeto vence hoje: ${p.name}`:`${p.name} vence em ${d} dia(s)`,date:p.deadline,priority:2});
  }
  for (const row of financeR.data || []) {
    const f = payloadRow(row); if (f.type !== "expense" || !f.date) continue;
    const d = daysBetween(today, f.date);
    if (d >= 0 && d <= 2) alerts.push({icon:"💵",title:d===0?`Conta hoje: ${f.description}`:`${f.description} vence em ${d} dia(s)`,date:f.date,priority:3});
  }
  for (const row of calendarR.data || []) {
    const e = payloadRow(row); if (!e.date) continue;
    const d = daysBetween(today, e.date);
    if (d >= 0 && d <= 1) alerts.push({icon:"📅",title:d===0?`Hoje: ${e.title}`:`Amanhã: ${e.title}`,date:e.date,priority:3});
  }
  for (const row of petsR.data || []) {
    const p = payloadRow(row);
    for (const v of p.vaccines || []) { if (!v.nextDate) continue; const d = daysBetween(today,v.nextDate); if (d>=0&&d<=3) alerts.push({icon:"💉",title:`${v.name} de ${p.name} em ${d===0?"hoje":`${d} dia(s)`}`,date:v.nextDate,priority:2}); }
    for (const v of p.visits || []) { if (!v.date) continue; const d = daysBetween(today,v.date); if (d>=0&&d<=1) alerts.push({icon:"🐾",title:`Consulta de ${p.name} ${d===0?"hoje":"amanhã"}`,date:v.date,priority:2}); }
  }
  for (const row of vehiclesR.data || []) {
    const v = payloadRow(row);
    for (const m of v.maintenances || []) { if (!m.nextDate) continue; const d = daysBetween(today,m.nextDate); if (d>=0&&d<=3) alerts.push({icon:"🔧",title:`${v.name}: ${m.service} em ${d===0?"hoje":`${d} dia(s)`}`,date:m.nextDate,priority:1}); }
  }
  return alerts.sort((a,b)=>b.priority-a.priority || a.date.localeCompare(b.date));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return Response.json({ ok:false, error:"VAPID secrets not configured" }, { status: 500 });

  const { data: subs, error } = await supabase.from("push_subscriptions").select("user_id,endpoint,subscription").eq("enabled", true);
  if (error) return Response.json({ ok:false, error:error.message }, { status: 500 });
  const byUser = new Map<string, any[]>();
  for (const row of subs || []) { const list=byUser.get(row.user_id)||[]; list.push(row); byUser.set(row.user_id,list); }
  const today = localDateKey();
  let sent = 0;

  for (const [userId, userSubs] of byUser) {
    const deliveryKey = `daily:${today}`;
    const { data: already } = await supabase.from("push_delivery_log").select("id").eq("user_id", userId).eq("delivery_key", deliveryKey).maybeSingle();
    if (already) continue;
    const alerts = await userAlerts(userId);
    if (!alerts.length) continue;
    const top = alerts[0];
    const body = alerts.length === 1 ? top.title : `${top.title} • +${alerts.length-1} lembrete(s)`;
    const payload = JSON.stringify({ title:"Frontier — Hoje", body, icon:"./icons/icon-192.png", badge:"./icons/icon-192.png", url:"./" });
    let userSent = false;
    for (const sub of userSubs) {
      try { await webpush.sendNotification(sub.subscription as any, payload); sent++; userSent = true; }
      catch (err:any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        else console.error("push error", err);
      }
    }
    if (userSent) await supabase.from("push_delivery_log").insert({ user_id:userId, delivery_key:deliveryKey });
  }
  return Response.json({ ok:true, sent });
});
