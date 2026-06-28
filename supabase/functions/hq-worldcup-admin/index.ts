const defaultAllowedOrigins = [
  "https://penta1031.github.io",
  "https://hq-archive.vercel.app",
  "https://hq-archive-penta1031s-projects.vercel.app",
  "https://hq-archive-git-main-penta1031s-projects.vercel.app",
  "http://localhost:3000"
];
const allowedOrigins = [...new Set([
  ...defaultAllowedOrigins,
  ...(Deno.env.get("HQ_ALLOWED_ORIGINS") || "").split(",")
])].map((value) => value.trim()).filter(Boolean);
const encoder = new TextEncoder();

function cors(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-hq-admin-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(request), "Content-Type": "application/json; charset=utf-8" } });
}

const text = (value: unknown) => String(value ?? "").trim();
const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

async function validSession(token: string, secret: string) {
  const [payload, signed] = token.split(".");
  if (!payload || !signed || signed !== await signature(payload, secret)) return false;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(base64));
    return decoded.role === "hq-admin" && Number(decoded.exp) > Date.now();
  } catch {
    return false;
  }
}

const supabaseUrl = text(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
const serviceKey = text(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

async function rest(resource: string, options: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.status === 204 ? [] : await response.json().catch(() => []);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return json(request, { ok: false, error: "POST required" }, 405);
  try {
    const sessionSecret = text(Deno.env.get("HQ_ADMIN_SESSION_SECRET") || Deno.env.get("ADMIN_SESSION_SECRET") || Deno.env.get("HQ_ADMIN_PASSWORD") || Deno.env.get("ADMIN_PASSWORD"));
    if (!sessionSecret || !await validSession(text(request.headers.get("x-hq-admin-session")), sessionSecret)) {
      return json(request, { ok: false, error: "관리자 인증이 만료되었습니다." }, 401);
    }

    const payload = await request.json();
    const action = text(payload.action);
    if (action === "worldcup-save") {
      const cup = payload.cup || {};
      const legacyId = text(cup.legacyCupId || cup.id || Date.now());
      const saved = await rest("hq_worldcups?on_conflict=legacy_cup_id", {
        method: "POST",
        body: JSON.stringify({
          legacy_cup_id: legacyId,
          title: text(cup.title),
          icon: text(cup.icon) || "🏆",
          sort_order: Number(cup.sortOrder || 0),
          is_active: true,
        }),
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      });
      const cupId = saved[0].id;
      const items = Array.isArray(cup.items) ? cup.items : [];
      const candidateRows = items.map((item: Record<string, unknown>, index: number) => ({
        worldcup_id: cupId,
        legacy_candidate_id: text(item.legacyCandidateId || item.id || Date.now() + index),
        name: text(item.name),
        occurred_on: text(item.date) || null,
        source_url: text(item.sourceUrl) || null,
        media_url: text(item.mediaUrl) || null,
        media_type: item.isVideo ? "video" : text(item.mediaUrl) ? "image" : "text",
        width: Number(item.width || 0),
        height: Number(item.height || 0),
        win_count: Number(item.winCount || 0),
        sort_order: index + 1,
        is_active: true,
      }));
      if (candidateRows.length) {
        await rest("hq_worldcup_candidates?on_conflict=worldcup_id,legacy_candidate_id", {
          method: "POST",
          body: JSON.stringify(candidateRows),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
      }
      const keep = new Set(candidateRows.map((item) => item.legacy_candidate_id));
      const existing = await rest(`hq_worldcup_candidates?select=id,legacy_candidate_id&worldcup_id=eq.${cupId}`);
      for (const item of existing) {
        if (!keep.has(text(item.legacy_candidate_id))) await rest(`hq_worldcup_candidates?id=eq.${item.id}`, { method: "DELETE" });
      }
      return json(request, { ok: true, cup: { ...cup, id: legacyId, supabaseId: cupId, legacyCupId: legacyId } });
    }

    if (action === "worldcup-delete") {
      await rest(`hq_worldcups?legacy_cup_id=eq.${encodeURIComponent(text(payload.id))}`, { method: "DELETE" });
      return json(request, { ok: true });
    }
    return json(request, { ok: false, error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    return json(request, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
