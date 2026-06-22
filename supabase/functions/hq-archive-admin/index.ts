const allowedOrigins = (Deno.env.get("HQ_ALLOWED_ORIGINS") || "https://penta1031.github.io,http://localhost:3000")
  .split(",").map((value) => value.trim()).filter(Boolean);
const encoder = new TextEncoder();
const sessionMs = 30 * 60 * 1000;

function cors(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-hq-admin-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
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
async function issueSession(secret: string) {
  const payload = base64Url(encoder.encode(JSON.stringify({ role: "hq-admin", exp: Date.now() + sessionMs })));
  return `${payload}.${await signature(payload, secret)}`;
}
async function validSession(token: string, secret: string) {
  const [payload, signed] = token.split(".");
  if (!payload || !signed || signed !== await signature(payload, secret)) return false;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(base64));
    return decoded.role === "hq-admin" && Number(decoded.exp) > Date.now();
  } catch { return false; }
}

const supabaseUrl = text(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
const serviceKey = text(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
async function rest(resource: string, options: RequestInit = {}, count = false) {
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase server secrets are not configured.");
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    ...options,
    headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(count ? { Prefer: "count=exact" } : {}), ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const rows = response.status === 204 ? [] : await response.json().catch(() => []);
  const range = response.headers.get("content-range") || "";
  return { rows, total: Number(range.split("/")[1] || rows.length) };
}
async function invokeFunction(name: string, body: Record<string, unknown>) {
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase server secrets are not configured.");
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) throw new Error(text(result.error) || `${name} 호출에 실패했습니다 (${response.status}).`);
  return result;
}
const escapeLike = (value: string) => value.replace(/[,*()]/g, " ").trim();
async function categoryIds(mainCategory: string, subCategory: string) {
  if (!mainCategory || mainCategory === "#N/A") return { category_id: null, subcategory_id: null };
  const categories = await rest(`hq_archive_categories?select=id&name=eq.${encodeURIComponent(mainCategory)}&limit=1`);
  const categoryId = categories.rows[0]?.id || null;
  if (!categoryId || !subCategory) return { category_id: categoryId, subcategory_id: null };
  const subs = await rest(`hq_archive_subcategories?select=id&category_id=eq.${categoryId}&name=eq.${encodeURIComponent(subCategory)}&limit=1`);
  return { category_id: categoryId, subcategory_id: subs.rows[0]?.id || null };
}
async function archiveRow(item: Record<string, unknown>, status?: string) {
  const ids = await categoryIds(text(item.mainCategory), text(item.subCategory));
  return {
    title: text(item.title), occurred_on: text(item.date) || null, source_url: text(item.link) || null,
    account: text(item.account) || null, ...ids,
    keywords: Array.isArray(item.keywords) ? item.keywords.map(text).filter(Boolean) : text(item.rawKeywords).split(/[,#]/).map(text).filter(Boolean),
    thumbnail_url: text(item.thumbnailUrl) || null, status: status || text(item.status) || "published",
    source_type: text(item.sourceType) || "manual"
  };
}
function mappedArchive(row: Record<string, unknown>) {
  const category = row.category as Record<string, unknown> | null;
  const subcategory = row.subcategory as Record<string, unknown> | null;
  return {
    id: row.id, title: row.title, date: row.occurred_on || "", link: row.source_url || "", account: row.account || "",
    mainCategory: category?.name || "", subCategory: subcategory?.name || "", keywords: row.keywords || [],
    rawKeywords: Array.isArray(row.keywords) ? row.keywords.join(", ") : "", thumbnailUrl: row.thumbnail_url || "", status: row.status
  };
}
const recommendedVideoCategories = new Set(["연말결산", "라이브", "레코딩로그", "승협캠프", "그 외 자컨", "웹/예능"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function recommendedVideoUpdateRow(id: string, updates: Record<string, unknown>) {
  if (!uuidPattern.test(id)) throw new Error("추천 영상 ID가 올바르지 않습니다.");
  if (typeof updates.isActive !== "boolean" || typeof updates.isFeatured !== "boolean") throw new Error("노출 및 PICK 설정이 올바르지 않습니다.");
  if (!Array.isArray(updates.categories)) throw new Error("카테고리 값이 올바르지 않습니다.");
  const categories = [...new Set(updates.categories.map(text).filter(Boolean))];
  if (categories.some((category) => !recommendedVideoCategories.has(category))) throw new Error("허용되지 않은 추천 영상 카테고리가 포함되어 있습니다.");
  const sortOrder = Number(updates.sortOrder); const featuredOrder = Number(updates.featuredOrder);
  if (!Number.isInteger(sortOrder) || !Number.isInteger(featuredOrder)) throw new Error("목록 순서는 정수로 입력해주세요.");
  return {
    is_active: updates.isActive,
    is_featured: updates.isFeatured,
    categories,
    sort_order: sortOrder,
    featured_order: featuredOrder,
    admin_comment: text(updates.adminComment) || null
  };
}
async function twitterSearch(payload: Record<string, unknown>) {
  const bearer = text(Deno.env.get("X_BEARER_TOKEN"));
  if (!bearer) throw new Error("X_BEARER_TOKEN is not configured.");
  const username = text(payload.twitterId).replace(/^@/, "");
  const startDate = text(payload.startDate);
  const endDate = text(payload.endDate);
  if (!username || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("계정과 날짜 범위를 확인해주세요.");
  const headers = { Authorization: `Bearer ${bearer}` };
  const start = new Date(`${startDate}T00:00:00+09:00`);
  let end = new Date(`${endDate}T23:59:59+09:00`);
  const now = new Date();
  if (end > now) end = new Date(now.getTime() - 60_000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new Error("조회 날짜 범위가 올바르지 않습니다.");
  const params = new URLSearchParams({
    query: `from:${username}`,
    max_results: "100",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    expansions: "attachments.media_keys",
    "tweet.fields": "created_at,text,author_id,in_reply_to_user_id,referenced_tweets,attachments",
    "media.fields": "type,url,preview_image_url,width,height,variants"
  });
  const tweetsResponse = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, { headers });
  if (!tweetsResponse.ok) {
    const details = await tweetsResponse.json().catch(() => ({}));
    throw new Error(text(details.detail || details.title) || `X search failed (${tweetsResponse.status}).`);
  }
  const result = await tweetsResponse.json();
  const media = new Map((result.includes?.media || []).map((item: Record<string, unknown>) => [item.media_key, item]));
  const kstFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const kstDate = (value: unknown) => {
    const parts = Object.fromEntries(kstFormatter.formatToParts(new Date(text(value))).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  return (result.data || []).filter((tweet: Record<string, unknown>) => {
    const references = Array.isArray(tweet.referenced_tweets) ? tweet.referenced_tweets as Record<string, unknown>[] : [];
    if (references.some((item) => item.type === "retweeted")) return false;
    return !tweet.in_reply_to_user_id || tweet.in_reply_to_user_id === tweet.author_id;
  }).map((tweet: Record<string, unknown>) => {
    const keys = (tweet.attachments as Record<string, string[]> | undefined)?.media_keys || [];
    const attached = keys.map((key: string) => media.get(key)).filter(Boolean) as Record<string, unknown>[];
    const chosen = attached.find((item) => item.type === "video" || item.type === "animated_gif") || attached[0];
    const variants = Array.isArray(chosen?.variants) ? chosen.variants as Record<string, unknown>[] : [];
    const mp4 = variants.filter((item) => text(item.content_type).includes("mp4")).sort((a, b) => Number(b.bit_rate || 0) - Number(a.bit_rate || 0))[0];
    return {
      id: `twitter-${tweet.id}`, title: text(tweet.text), date: kstDate(tweet.created_at),
      link: `https://x.com/${username}/status/${tweet.id}`, account: username, mainCategory: "SNS", subCategory: "공식 트위터",
      keywords: [], rawKeywords: "", thumbnailUrl: text(chosen?.preview_image_url || chosen?.url),
      mediaUrl: text(mp4?.url || chosen?.url), mediaType: chosen?.type === "photo" ? "image" : chosen ? "video" : "text", sourceType: "twitter"
    };
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return json(request, { ok: false, error: "POST required" }, 405);
  try {
    const payload = await request.json();
    const action = text(payload.action);
    const adminPassword = text(Deno.env.get("HQ_ADMIN_PASSWORD") || Deno.env.get("ADMIN_PASSWORD"));
    const sessionSecret = text(Deno.env.get("HQ_ADMIN_SESSION_SECRET") || Deno.env.get("ADMIN_SESSION_SECRET")) || adminPassword;
    if (action === "login") {
      if (!adminPassword || text(payload.password) !== adminPassword) return json(request, { ok: false, error: "비밀번호가 올바르지 않습니다." }, 401);
      return json(request, { ok: true, token: await issueSession(sessionSecret), expiresIn: sessionMs / 1000 });
    }
    if (!await validSession(text(request.headers.get("x-hq-admin-session")), sessionSecret)) return json(request, { ok: false, error: "관리자 인증이 만료되었습니다." }, 401);

    if (action === "archive-list") {
      const page = Math.max(1, Number(payload.page || 1)); const limit = Math.min(100, Math.max(1, Number(payload.limit || 30)));
      const params = new URLSearchParams({ select: "*,category:hq_archive_categories(name),subcategory:hq_archive_subcategories(name)", order: "occurred_on.desc.nullslast,id.desc", offset: String((page - 1) * limit), limit: String(limit) });
      if (payload.status) params.set("status", `eq.${text(payload.status)}`);
      if (payload.dateFrom) params.set("occurred_on", `gte.${text(payload.dateFrom)}`);
      if (payload.dateTo) params.append("occurred_on", `lte.${text(payload.dateTo)}`);
      if (payload.query) { const q = escapeLike(text(payload.query)); params.set("or", `(title.ilike.*${q}*,account.ilike.*${q}*,source_url.ilike.*${q}*)`); }
      if (text(payload.mainCategory) && text(payload.mainCategory) !== "전체") {
        const ids = await categoryIds(text(payload.mainCategory), text(payload.subCategory) === "전체" ? "" : text(payload.subCategory));
        if (ids.category_id) params.set("category_id", `eq.${ids.category_id}`);
        if (ids.subcategory_id) params.set("subcategory_id", `eq.${ids.subcategory_id}`);
      }
      const result = await rest(`hq_archive_contents?${params}`, {}, true);
      return json(request, { ok: true, items: result.rows.map(mappedArchive), total: result.total, page, hasMore: page * limit < result.total });
    }
    if (action === "archive-create") {
      const row = await archiveRow(payload.item || {}, text(payload.status) || undefined);
      const result = await rest("hq_archive_contents", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
      return json(request, { ok: true, item: mappedArchive(result.rows[0]) });
    }
    if (action === "archive-update") {
      const row = await archiveRow(payload.item || {}); const id = Number(payload.id || payload.item?.id);
      await rest(`hq_archive_contents?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(row), headers: { Prefer: "return=minimal" } });
      return json(request, { ok: true });
    }
    if (action === "archive-delete") { await rest(`hq_archive_contents?id=eq.${Number(payload.id)}`, { method: "DELETE" }); return json(request, { ok: true }); }
    if (action === "archive-save-drafts") {
      const rows = []; for (const item of payload.items || []) rows.push(await archiveRow(item, "draft"));
      await rest("hq_archive_contents", { method: "POST", body: JSON.stringify(rows), headers: { Prefer: "return=minimal" } });
      return json(request, { ok: true, count: rows.length });
    }
    if (action === "archive-publish") { await rest(`hq_archive_contents?id=eq.${Number(payload.id)}`, { method: "PATCH", body: JSON.stringify({ status: "published" }), headers: { Prefer: "return=minimal" } }); return json(request, { ok: true }); }
    if (action === "twitter-search") return json(request, { ok: true, items: await twitterSearch(payload) });

    if (action === "recommended-video-list") {
      const fields = "id,youtube_id,youtube_url,title,published_at,thumbnail_url,categories,admin_comment,sort_order,featured_order,is_featured,is_active,source,channel_id,channel_title,created_at,updated_at";
      const result = await rest(`recommended_videos?select=${fields}&order=published_at.desc.nullslast&limit=1000`);
      return json(request, { ok: true, items: result.rows });
    }
    if (action === "recommended-video-update") {
      const id = text(payload.id);
      const updates = payload.updates && typeof payload.updates === "object" ? payload.updates : {};
      const row = recommendedVideoUpdateRow(id, updates as Record<string, unknown>);
      const result = await rest(`recommended_videos?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
      if (!result.rows[0]) throw new Error("수정할 추천 영상을 찾을 수 없습니다.");
      return json(request, { ok: true, item: result.rows[0] });
    }
    if (action === "recommended-video-bulk-update") {
      const entries = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
      if (!entries.length || entries.length > 100) throw new Error("한 번에 저장할 추천 영상은 1개 이상 100개 이하여야 합니다.");
      const saved = await Promise.all(entries.map(async (entry) => {
        const id = text(entry.id);
        const updates = entry.updates && typeof entry.updates === "object" ? entry.updates as Record<string, unknown> : {};
        const row = recommendedVideoUpdateRow(id, updates);
        const result = await rest(`recommended_videos?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
        if (!result.rows[0]) throw new Error("수정할 추천 영상을 찾을 수 없습니다.");
        return result.rows[0];
      }));
      return json(request, { ok: true, items: saved });
    }
    if (action === "recommended-video-delete") {
      const ids = [...new Set((Array.isArray(payload.ids) ? payload.ids : []).map(text).filter(Boolean))];
      if (!ids.length || ids.length > 100) throw new Error("한 번에 삭제할 추천 영상은 1개 이상 100개 이하여야 합니다.");
      if (ids.some((id) => !uuidPattern.test(id))) throw new Error("추천 영상 ID가 올바르지 않습니다.");
      const result = await rest(`recommended_videos?id=in.(${ids.join(",")})`, { method: "DELETE", headers: { Prefer: "return=representation" } });
      return json(request, { ok: true, deletedCount: result.rows.length });
    }
    if (action === "recommended-video-add") {
      const youtubeUrl = text(payload.youtubeUrl);
      if (!youtubeUrl) throw new Error("추가할 YouTube 링크를 입력해주세요.");
      const result = await invokeFunction("recommended-videos", { youtube_url: youtubeUrl });
      return json(request, { ok: true, item: result.data || null });
    }
    if (action === "recommended-video-channel-sync") {
      const result = await invokeFunction("recommended-videos-channel-sync", {});
      return json(request, { ok: true, totalInserted: Number(result.total_inserted || 0), channels: result.channels || [] });
    }

    if (action === "worldcup-save") {
      const cup = payload.cup || {}; const legacyId = text(cup.legacyCupId || cup.id || Date.now());
      const saved = await rest("hq_worldcups?on_conflict=legacy_cup_id", { method: "POST", body: JSON.stringify({ legacy_cup_id: legacyId, title: text(cup.title), icon: text(cup.icon) || "🏆", sort_order: Number(cup.sortOrder || 0), is_active: true }), headers: { Prefer: "resolution=merge-duplicates,return=representation" } });
      const cupId = saved.rows[0].id; const items = Array.isArray(cup.items) ? cup.items : [];
      const candidateRows = items.map((item: Record<string, unknown>, index: number) => ({
        worldcup_id: cupId, legacy_candidate_id: text(item.legacyCandidateId || item.id || Date.now() + index), name: text(item.name), occurred_on: text(item.date) || null,
        source_url: text(item.sourceUrl) || null, media_url: text(item.mediaUrl) || null, media_type: item.isVideo ? "video" : text(item.mediaUrl) ? "image" : "text",
        width: Number(item.width || 0), height: Number(item.height || 0), win_count: Number(item.winCount || 0), sort_order: index + 1, is_active: true
      }));
      if (candidateRows.length) await rest("hq_worldcup_candidates?on_conflict=worldcup_id,legacy_candidate_id", { method: "POST", body: JSON.stringify(candidateRows), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
      const keep = new Set(candidateRows.map((item) => item.legacy_candidate_id));
      const existing = await rest(`hq_worldcup_candidates?select=id,legacy_candidate_id&worldcup_id=eq.${cupId}`);
      for (const item of existing.rows) if (!keep.has(text(item.legacy_candidate_id))) await rest(`hq_worldcup_candidates?id=eq.${item.id}`, { method: "DELETE" });
      return json(request, { ok: true, cup: { ...cup, id: cupId, legacyCupId: legacyId } });
    }
    if (action === "worldcup-delete") { await rest(`hq_worldcups?id=eq.${Number(payload.id)}`, { method: "DELETE" }); return json(request, { ok: true }); }

    return json(request, { ok: false, error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) { return json(request, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500); }
});
