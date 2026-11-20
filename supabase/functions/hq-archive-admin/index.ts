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
const appTabMeta = [
  { tab_key: "home", label: "홈", sort_order: 10 },
  { tab_key: "calendar", label: "캘린더", sort_order: 20 },
  { tab_key: "recommended", label: "추천", sort_order: 30 },
  { tab_key: "index", label: "모아보기", sort_order: 40 },
];
const appTabKeys = new Set(appTabMeta.map((item) => item.tab_key));
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
function detailFromYoutube(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return "";
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : "";
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
function directThumbnailUrl(sourceUrl: string) {
  if (/^https?:\/\/.+\.(?:jpg|jpeg|png|webp|gif)(?:$|[?#])/i.test(sourceUrl)) return sourceUrl;
  return "";
}
async function resolveArchiveThumbnail(sourceUrl: string) {
  const direct = directThumbnailUrl(sourceUrl);
  if (direct) return direct;
  if (/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i.test(sourceUrl)) {
    const result = await invokeFunction("hq-twitter-media", { sourceUrl });
    const data = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {};
    return text(data.thumbnailUrl || data.thumbnail_url || data.preview_image_url || data.poster || (!data.isVideo ? data.url : ""));
  }
  return "";
}
async function appTabSettingsRows(settings: unknown) {
  const values = settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
  const rows = appTabMeta.map((item) => ({
    ...item,
    is_visible: values[item.tab_key] !== false,
  }));
  if (!rows.some((row) => row.is_visible)) throw new Error("최소 1개 탭은 ON 상태여야 합니다.");
  const invalidKeys = Object.keys(values).filter((key) => !appTabKeys.has(key));
  if (invalidKeys.length) throw new Error("허용되지 않은 탭 설정이 포함되어 있습니다.");
  return rows;
}
const escapeLike = (value: string) => value.replace(/[,*()]/g, " ").trim();
function exactKstArchiveDate(value: unknown) {
  const candidate = text(value);
  const match = candidate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? candidate : "";
}
function twitterStatusId(value: unknown) {
  const match = text(value).match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
  return match?.[1] || "";
}
function kstTimestampRange(value: unknown) {
  const date = exactKstArchiveDate(value);
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month - 1, day + 1) - 9 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
async function categoryIds(mainCategory: string, subCategory: string) {
  if (!mainCategory || mainCategory === "#N/A") return { category_id: null, subcategory_id: null };
  const categories = await rest(`hq_archive_categories?select=id&name=eq.${encodeURIComponent(mainCategory)}&limit=1`);
  const categoryId = categories.rows[0]?.id || null;
  if (!categoryId || !subCategory) return { category_id: categoryId, subcategory_id: null };
  const subs = await rest(`hq_archive_subcategories?select=id&category_id=eq.${categoryId}&name=eq.${encodeURIComponent(subCategory)}&limit=1`);
  return { category_id: categoryId, subcategory_id: subs.rows[0]?.id || null };
}
async function archiveRow(item: Record<string, unknown>, status?: string) {
  const mainCategory = text(item.mainCategory);
  const subCategory = text(item.subCategory);
  const ids = await categoryIds(mainCategory, subCategory);
  if (mainCategory && !ids.category_id) throw new Error(`대분류 '${mainCategory}'를 찾지 못했습니다. 분류 목록을 새로고침해주세요.`);
  if (subCategory && !ids.subcategory_id) throw new Error(`소분류 '${subCategory}'를 '${mainCategory}'에서 찾지 못했습니다. 다른 소분류를 선택해주세요.`);
  if ((status || text(item.status) || "published") === "published" && !ids.subcategory_id) throw new Error("게시할 기록의 소분류를 선택해주세요.");
  const rawKeywords = text(item.rawKeywords);
  const keywords = rawKeywords
    ? rawKeywords.split(/[,#]/).map(text).filter(Boolean)
    : Array.isArray(item.keywords) ? item.keywords.map(text).filter(Boolean) : [];
  return {
    title: text(item.title), occurred_on: text(item.date) || null, source_url: text(item.link) || null,
    account: text(item.account) || null, ...ids,
    keywords,
    thumbnail_url: text(item.thumbnailUrl) || null, status: status || text(item.status) || "published",
    source_type: text(item.sourceType) || "manual",
    twitter_conversation_id: text(item.twitterConversationId) || null
  };
}
function mappedArchive(row: Record<string, unknown>) {
  const category = row.category as Record<string, unknown> | null;
  const subcategory = row.subcategory as Record<string, unknown> | null;
  return {
    id: row.id, title: row.title, date: row.occurred_on || "", link: row.source_url || "", account: row.account || "",
    mainCategory: category?.name || "", subCategory: subcategory?.name || "", keywords: row.keywords || [],
    rawKeywords: Array.isArray(row.keywords) ? row.keywords.join(", ") : "", thumbnailUrl: row.thumbnail_url || "", status: row.status,
    twitterConversationId: row.thread_root_tweet_id || row.twitter_conversation_id || "", twitterStatusId: twitterStatusId(row.source_url)
  };
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function allowedRecommendedVideoCategories() {
  const result = await rest("recommended_video_categories?select=name&order=sort_order.asc,created_at.asc");
  return new Set(result.rows.map((row) => text(row.name)).filter(Boolean));
}
function recommendedVideoUpdateRow(id: string, updates: Record<string, unknown>, allowedCategories: Set<string>) {
  if (!uuidPattern.test(id)) throw new Error("추천 영상 ID가 올바르지 않습니다.");
  if (typeof updates.isActive !== "boolean" || typeof updates.isFeatured !== "boolean") throw new Error("노출 및 PICK 설정이 올바르지 않습니다.");
  if (updates.isHyeopkwaePick !== undefined && typeof updates.isHyeopkwaePick !== "boolean") throw new Error("HQ PICK 설정이 올바르지 않습니다.");
  if (!Array.isArray(updates.categories)) throw new Error("카테고리 값이 올바르지 않습니다.");
  const categories = [...new Set(updates.categories.map(text).filter(Boolean))];
  if (categories.some((category) => !allowedCategories.has(category))) throw new Error("허용되지 않은 추천 영상 카테고리가 포함되어 있습니다.");
  const sortOrder = Number(updates.sortOrder); const featuredOrder = Number(updates.featuredOrder);
  if (!Number.isInteger(sortOrder) || !Number.isInteger(featuredOrder)) throw new Error("목록 순서는 정수로 입력해주세요.");
  const row: Record<string, unknown> = {
    is_active: updates.isActive,
    is_featured: updates.isFeatured,
    categories,
    sort_order: sortOrder,
    featured_order: featuredOrder,
    admin_comment: text(updates.adminComment) || null
  };
  if (typeof updates.isHyeopkwaePick === "boolean") row.is_hyeopkwae_pick = updates.isHyeopkwaePick;
  if (updates.publishedAt !== undefined) {
    const publishedAt = text(updates.publishedAt);
    if (!publishedAt) row.published_at = null;
    else {
      const publishedDate = new Date(publishedAt);
      if (Number.isNaN(publishedDate.getTime())) throw new Error("업로드 날짜가 올바르지 않습니다.");
      row.published_at = publishedDate.toISOString();
    }
  }
  return row;
}
function booleanFilter(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (normalized === "true") return "true";
  if (normalized === "false") return "false";
  return "";
}
async function refreshRecommendedVideoPublishedDates() {
  const youtubeApiKey = text(Deno.env.get("YOUTUBE_API_KEY"));
  if (!youtubeApiKey) throw new Error("Supabase Secret에 YOUTUBE_API_KEY가 설정되지 않았습니다.");

  const rows: Record<string, unknown>[] = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const result = await rest(`recommended_videos?select=id,youtube_id,published_at&order=id.asc&offset=${offset}&limit=${limit}`, {}, true);
    rows.push(...result.rows.filter((row) => text(row.youtube_id)));
    if (result.rows.length < limit) break;
  }

  let checked = 0;
  let updated = 0;
  let missing = 0;
  for (let index = 0; index < rows.length; index += 50) {
    const chunk = rows.slice(index, index + 50);
    const ids = [...new Set(chunk.map((row) => text(row.youtube_id)).filter(Boolean))];
    if (!ids.length) continue;

    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", youtubeApiKey);
    const response = await fetch(url);
    const youtubeResult = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = detailFromYoutube(youtubeResult);
      throw new Error(`YouTube Data API 호출에 실패했습니다 (${response.status})${detail ? `: ${detail}` : ""}`);
    }

    const byId = new Map<string, string>();
    for (const item of Array.isArray(youtubeResult.items) ? youtubeResult.items : []) {
      const videoId = text(item?.id);
      const publishedAt = text(item?.snippet?.publishedAt);
      if (videoId && publishedAt) byId.set(videoId, publishedAt);
    }

    for (const row of chunk) {
      checked += 1;
      const videoId = text(row.youtube_id);
      const publishedAt = byId.get(videoId);
      if (!publishedAt) { missing += 1; continue; }
      const currentTime = new Date(text(row.published_at)).getTime();
      const nextTime = new Date(publishedAt).getTime();
      if (Number.isNaN(nextTime)) { missing += 1; continue; }
      if (Number.isNaN(currentTime) || currentTime !== nextTime) {
        await rest(`recommended_videos?id=eq.${encodeURIComponent(text(row.id))}`, {
          method: "PATCH",
          body: JSON.stringify({ published_at: publishedAt }),
          headers: { Prefer: "return=minimal" }
        });
        updated += 1;
      }
    }
  }

  return { checked, updated, missing };
}
async function twitterSearch(payload: Record<string, unknown>, cursorSecret: string) {
  const bearer = text(Deno.env.get("X_BEARER_TOKEN"));
  if (!bearer) throw new Error("X_BEARER_TOKEN is not configured.");
  const username = text(payload.twitterId).replace(/^@/, "");
  const startDate = text(payload.startDate);
  const endDate = text(payload.endDate);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username) || !exactKstArchiveDate(startDate) || !exactKstArchiveDate(endDate)) throw new Error("계정과 날짜 범위를 확인해주세요.");
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
  if (days < 1 || days > 31) throw new Error("한 번에 최대 31일 범위만 조회할 수 있습니다.");
  if (startDate < "2006-03-22") throw new Error("2006년 3월 22일 이후 날짜를 선택해주세요.");
  const headers = { Authorization: `Bearer ${bearer}` };
  const start = new Date(`${startDate}T00:00:00+09:00`);
  let end = new Date(new Date(`${endDate}T00:00:00+09:00`).getTime() + 86_400_000);
  const now = new Date();
  if (end.getTime() > now.getTime() - 60_000) end = new Date(now.getTime() - 60_000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new Error("조회 날짜 범위가 올바르지 않습니다.");
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(payload.pageSize) || 100)));
  let nextToken = "";
  let frozenEnd = end.toISOString();
  if (payload.cursor) {
    try {
      const [encoded, signed] = text(payload.cursor).split(".");
      if (!encoded || signed !== await signature(encoded, cursorSecret)) throw new Error();
      const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      const cursor = JSON.parse(atob(base64));
      if (cursor.kind !== "twitter-search" || cursor.exp <= Date.now() || cursor.username !== username.toLowerCase() || cursor.startDate !== startDate || cursor.endDate !== endDate || cursor.pageSize !== pageSize || !cursor.nextToken || !Number.isFinite(Date.parse(cursor.endTime))) throw new Error();
      nextToken = cursor.nextToken;
      frozenEnd = cursor.endTime;
    } catch { throw new Error("이어받기 정보가 만료되었거나 조회 조건이 바뀌었습니다. 처음부터 다시 수집해주세요."); }
  }
  const params = new URLSearchParams({
    query: `from:${username}`,
    max_results: String(pageSize),
    start_time: start.toISOString(),
    end_time: frozenEnd,
    expansions: "attachments.media_keys",
    "tweet.fields": "created_at,text,author_id,in_reply_to_user_id,referenced_tweets,attachments,conversation_id",
    "media.fields": "type,url,preview_image_url,width,height,variants"
  });
  if (nextToken) params.set("next_token", nextToken);
  const quota = await rest("rpc/hq_reserve_twitter_search", { method: "POST", body: "{}" });
  const usage = quota.rows as { allowed?: boolean; reason?: string };
  if (usage.allowed !== true) throw new Error("요청이 너무 빠릅니다. 2초 후 다시 눌러주세요.");
  let tweetsResponse: Response;
  try {
    tweetsResponse = await fetch(`https://api.x.com/2/tweets/search/all?${params}`, { headers, signal: AbortSignal.timeout(20_000) });
  } catch { throw new Error("X 응답을 받지 못했습니다. 자동 재시도는 하지 않습니다."); }
  if (!tweetsResponse.ok) {
    const details = await tweetsResponse.json().catch(() => ({}));
    const message = tweetsResponse.status === 429 ? "X 호출 제한에 도달했습니다. 잠시 후 다시 시도해주세요." : tweetsResponse.status === 402 ? "X API 크레딧 또는 결제 한도를 확인해주세요." : tweetsResponse.status === 401 || tweetsResponse.status === 403 ? "X API 인증 또는 전체 검색 접근 권한을 확인해주세요." : text(details.errors?.[0]?.message || details.detail || details.title) || "X 검색 요청을 처리하지 못했습니다.";
    throw new Error(`${message} (X ${tweetsResponse.status})`);
  }
  const result = await tweetsResponse.json();
  const media = new Map((result.includes?.media || []).map((item: Record<string, unknown>) => [item.media_key, item]));
  const kstFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const kstDate = (value: unknown) => {
    const parts = Object.fromEntries(kstFormatter.formatToParts(new Date(text(value))).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const items = (result.data || []).filter((tweet: Record<string, unknown>) => {
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
      link: `https://x.com/${username}/status/${tweet.id}`, account: username, mainCategory: "", subCategory: "",
      keywords: [], rawKeywords: "", thumbnailUrl: text(chosen?.preview_image_url || chosen?.url),
      mediaUrl: text(mp4?.url || chosen?.url), mediaType: chosen?.type === "photo" ? "image" : chosen ? "video" : "text", sourceType: "twitter",
      twitterConversationId: text(tweet.conversation_id || tweet.id)
    };
  });
  let cursor = "";
  if (result.meta?.next_token) {
    const encoded = base64Url(encoder.encode(JSON.stringify({ kind: "twitter-search", username: username.toLowerCase(), startDate, endDate, pageSize, endTime: frozenEnd, nextToken: result.meta.next_token, exp: Date.now() + sessionMs })));
    cursor = `${encoded}.${await signature(encoded, cursorSecret)}`;
  }
  return { items, cursor, hasMore: Boolean(cursor), fetched: (result.data || []).length, warning: result.errors?.length ? "X에서 일부 데이터를 반환하지 못했습니다. 수집 결과를 확인해주세요." : "" };
}
async function refreshArchiveThumbnails(payload: Record<string, unknown>) {
  const ids = [...new Set((Array.isArray(payload.ids) ? payload.ids : []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
  if (!ids.length) throw new Error("썸네일을 불러올 기록을 선택해주세요.");
  if (ids.length > 100) throw new Error("썸네일은 한 번에 100개 이하로 불러올 수 있습니다.");

  const result = await rest(`hq_archive_contents?select=id,title,source_url,thumbnail_url,status&id=in.(${ids.join(",")})`);
  const rows = result.rows as Record<string, unknown>[];
  const foundIds = new Set(rows.map((row) => Number(row.id)));
  const missing = ids.filter((id) => !foundIds.has(id));
  const items: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  let skipped = missing.length;
  let updated = 0;

  for (const row of rows) {
    const id = Number(row.id);
    const sourceUrl = text(row.source_url);
    if (!sourceUrl) {
      skipped += 1;
      errors.push({ id, title: text(row.title), error: "랜딩 링크 없음" });
      continue;
    }
    try {
      const thumbnailUrl = await resolveArchiveThumbnail(sourceUrl);
      if (!thumbnailUrl) {
        skipped += 1;
        errors.push({ id, title: text(row.title), error: "썸네일 없음" });
        continue;
      }
      const saved = await rest(`hq_archive_contents?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
        headers: { Prefer: "return=representation" }
      });
      if (saved.rows[0]) {
        items.push({ id, thumbnailUrl });
        updated += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push({ id, title: text(row.title), error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { checked: ids.length, updated, skipped, missing: missing.length, errors: errors.slice(0, 20), items };
}

const kstDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
function dateOnly(value: unknown) {
  const candidate = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
}
function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}
async function viewStats(payload: Record<string, unknown>) {
  const today = kstDayFormatter.format(new Date());
  let dateTo = dateOnly(payload.dateTo) || today;
  let dateFrom = dateOnly(payload.dateFrom) || shiftDate(dateTo, -13);
  if (dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom];
  const offset = Math.max(0, Number(payload.offset || 0));
  const limit = Math.min(100, Math.max(1, Number(payload.limit || 30)));
  const query = text(payload.query).slice(0, 120);
  const [dailyResult, tabResult, contentResult] = await Promise.all([
    rest("rpc/hq_admin_view_daily", { method: "POST", body: JSON.stringify({ p_from: dateFrom, p_to: dateTo }) }),
    rest("rpc/hq_admin_view_tabs", { method: "POST", body: JSON.stringify({ p_from: dateFrom, p_to: dateTo }) }),
    rest("rpc/hq_admin_view_content", { method: "POST", body: JSON.stringify({ p_from: dateFrom, p_to: dateTo, p_query: query, p_offset: offset, p_limit: limit }) }),
  ]);
  const daily = dailyResult.rows as Record<string, unknown>[];
  const tabs = tabResult.rows as Record<string, unknown>[];
  const content = contentResult.rows as Record<string, unknown>[];
  const totals = daily.reduce((sum, row) => ({
    views: sum.views + Number(row.views || 0),
    tabViews: sum.tabViews + Number(row.tab_views || 0),
    contentViews: sum.contentViews + Number(row.content_views || 0),
  }), { views: 0, tabViews: 0, contentViews: 0 });
  const contentTotal = Number(content[0]?.total_count || 0);
  return {
    dateFrom,
    dateTo,
    totals,
    daily,
    tabs,
    content,
    contentTotal,
    hasMore: offset + content.length < contentTotal,
  };
}

async function searchStats(payload: Record<string, unknown>) {
  const today = kstDayFormatter.format(new Date());
  let dateTo = dateOnly(payload.dateTo) || shiftDate(today, -1);
  let dateFrom = dateOnly(payload.dateFrom) || dateTo;
  if (dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom];
  const limit = Math.min(20, Math.max(1, Number(payload.limit || 20)));
  const result = await rest("rpc/hq_admin_search_stats", {
    method: "POST",
    body: JSON.stringify({ p_from: dateFrom, p_to: dateTo, p_limit: limit }),
  });
  const data = (Array.isArray(result.rows) ? result.rows[0] : result.rows || {}) as Record<string, unknown>;
  return {
    dateFrom,
    dateTo,
    totals: data.totals || { searches: 0, visitors: 0, zeroResults: 0 },
    top: data.top || [],
    recent: data.recent || [],
  };
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

    if (action === "app-tab-settings") {
      const result = await rest("hq_app_tab_config?select=tab_key,label,sort_order,is_visible&order=sort_order.asc");
      return json(request, { ok: true, tabs: result.rows });
    }
    if (action === "app-tab-settings-update") {
      const rows = await appTabSettingsRows(payload.settings);
      const result = await rest("hq_app_tab_config?on_conflict=tab_key", {
        method: "POST",
        body: JSON.stringify(rows),
        headers: { Prefer: "resolution=merge-duplicates,return=representation" }
      });
      const sorted = [...result.rows].sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      return json(request, { ok: true, tabs: sorted });
    }

    if (action === "archive-list") {
      const page = Math.max(1, Number(payload.page || 1)); const limit = Math.min(100, Math.max(1, Number(payload.limit || 30)));
      if (/^\d{2}-\d{2}$/.test(text(payload.monthDay))) {
        const ids = await categoryIds(text(payload.mainCategory) === "전체" ? "" : text(payload.mainCategory), text(payload.subCategory) === "전체" ? "" : text(payload.subCategory));
        const result = await rest("rpc/hq_admin_archive_month_day", { method: "POST", body: JSON.stringify({ p_month_day: text(payload.monthDay), p_status: text(payload.status) || "published", p_query: text(payload.query), p_category_id: ids.category_id, p_subcategory_id: ids.subcategory_id, p_offset: (page - 1) * limit, p_limit: limit }) });
        const data = (Array.isArray(result.rows) ? result.rows[0] : result.rows || {}) as Record<string, unknown>;
        return json(request, { ok: true, items: data.items || [], total: Number(data.total || 0), page, hasMore: page * limit < Number(data.total || 0) });
      }
      const params = new URLSearchParams({ select: "*,category:hq_archive_categories(name),subcategory:hq_archive_subcategories(name)", order: "occurred_on.desc.nullslast,id.desc", offset: String((page - 1) * limit), limit: String(limit) });
      if (payload.status) params.set("status", `eq.${text(payload.status)}`);
      if (payload.dateFrom) params.set("occurred_on", `gte.${text(payload.dateFrom)}`);
      if (payload.dateTo) params.append("occurred_on", `lte.${text(payload.dateTo)}`);
      if (payload.query) {
        const exactDate = exactKstArchiveDate(payload.query);
        if (exactDate) params.set("occurred_on", `eq.${exactDate}`);
        else { const q = escapeLike(text(payload.query)); params.set("or", `(title.ilike.*${q}*,account.ilike.*${q}*,source_url.ilike.*${q}*)`); }
      }
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
    if (action === "archive-thread-update") {
      const id = Number(payload.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("기록 ID가 올바르지 않습니다.");
      const current = await rest(`hq_archive_contents?select=status&id=eq.${id}&limit=1`);
      if (!current.rows.length) throw new Error("기록을 찾지 못했습니다.");
      const row = await archiveRow(payload.item || {}, text(current.rows[0].status));
      const result = await rest("rpc/hq_update_archive_thread", { method: "POST", body: JSON.stringify({ p_id: id, p_item: row }) });
      return json(request, { ok: true, affectedCount: Number(result.rows) });
    }
    if (action === "archive-thread-info") {
      const id = Number(payload.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("기록 ID가 올바르지 않습니다.");
      const result = await rest("rpc/hq_archive_thread_counts", { method: "POST", body: JSON.stringify({ p_id: id }) });
      return json(request, { ok: true, total: Number(result.rows[0]?.total || 0), applicable: Number(result.rows[0]?.applicable || 0) });
    }
    if (action === "archive-refresh-thumbnails") return json(request, { ok: true, ...await refreshArchiveThumbnails(payload) });
    if (action === "archive-delete") { await rest(`hq_archive_contents?id=eq.${Number(payload.id)}`, { method: "DELETE" }); return json(request, { ok: true }); }
    if (action === "archive-save-drafts") {
      const rows = []; for (const item of payload.items || []) rows.push(await archiveRow(item, "draft"));
      if (!rows.length) return json(request, { ok: true, count: 0, inserted: 0, skipped: 0 });
      const result = await rest("hq_archive_contents?on_conflict=tweet_id", {
        method: "POST",
        body: JSON.stringify(rows),
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" }
      });
      return json(request, { ok: true, count: rows.length, inserted: result.rows.length, skipped: rows.length - result.rows.length });
    }
    if (action === "archive-publish") { await rest(`hq_archive_contents?id=eq.${Number(payload.id)}`, { method: "PATCH", body: JSON.stringify({ status: "published" }), headers: { Prefer: "return=minimal" } }); return json(request, { ok: true }); }
    if (action === "twitter-search") return json(request, { ok: true, ...await twitterSearch(payload, sessionSecret) });
    if (action === "view-stats") return json(request, { ok: true, ...await viewStats(payload) });
    if (action === "search-stats") return json(request, { ok: true, ...await searchStats(payload) });

    if (action === "recommended-video-list") {
      const fields = "id,youtube_id,youtube_url,title,published_at,thumbnail_url,categories,admin_comment,sort_order,featured_order,is_featured,is_hyeopkwae_pick,is_active,source,channel_id,channel_title,created_at,updated_at";
      const offset = Math.max(0, Number(payload.offset || 0));
      const limit = Math.min(100, Math.max(1, Number(payload.limit || 30)));
      const params = new URLSearchParams({ select: fields, order: "published_at.desc.nullslast,id.desc", offset: String(offset), limit: String(limit) });
      const query = text(payload.query);
      const category = text(payload.category);
      const activeFilter = booleanFilter(payload.isActive);
      const featuredFilter = booleanFilter(payload.isFeatured);
      const hyeopkwaePickFilter = booleanFilter(payload.isHyeopkwaePick);
      const normalizedQuery = query.toLocaleLowerCase("ko-KR");
      const isHyeopkwaePickSearch = /[혚혜]쾌/.test(normalizedQuery) && normalizedQuery.includes("pick");
      const dateRange = kstTimestampRange(query);
      if (dateRange) {
        params.set("published_at", `gte.${dateRange.start}`);
        params.append("published_at", `lt.${dateRange.end}`);
      } else if (query && !isHyeopkwaePickSearch) {
        const q = escapeLike(query);
        if (q) params.set("or", `(title.ilike.*${q}*,channel_title.ilike.*${q}*,youtube_id.ilike.*${q}*,admin_comment.ilike.*${q}*)`);
      }
      if (category === "__uncategorized__") params.set("categories", "eq.{}");
      else if (category && category.length <= 120 && !/[{},"]/.test(category)) params.set("categories", `cs.{${category}}`);
      if (activeFilter) params.set("is_active", `eq.${activeFilter}`);
      if (featuredFilter) params.set("is_featured", `eq.${featuredFilter}`);
      if (hyeopkwaePickFilter) params.set("is_hyeopkwae_pick", `eq.${hyeopkwaePickFilter}`);
      else if (isHyeopkwaePickSearch) params.set("is_hyeopkwae_pick", "eq.true");
      const result = await rest(`recommended_videos?${params}`, {}, true);
      return json(request, { ok: true, items: result.rows, total: result.total, hasMore: offset + result.rows.length < result.total });
    }
    if (action === "recommended-video-admin-summary") {
      const featuredFields = "id,youtube_url,title,published_at,thumbnail_url,categories,admin_comment,featured_order,is_hyeopkwae_pick,is_active,channel_title";
      const [all, featured, hyeopkwaePick] = await Promise.all([
        rest("recommended_videos?select=id&limit=1", {}, true),
        rest(`recommended_videos?select=${featuredFields}&is_active=eq.true&is_featured=eq.true&order=featured_order.asc,published_at.desc.nullslast&limit=100`, {}, true),
        rest("recommended_videos?select=id&is_active=eq.true&is_hyeopkwae_pick=eq.true&limit=1", {}, true),
      ]);
      return json(request, {
        ok: true,
        total: all.total,
        featuredActiveCount: featured.total,
        hyeopkwaePickActiveCount: hyeopkwaePick.total,
        featuredItems: featured.rows,
      });
    }
    if (action === "recommended-video-refresh-published-dates") {
      return json(request, { ok: true, ...await refreshRecommendedVideoPublishedDates() });
    }
    if (action === "recommended-video-update") {
      const id = text(payload.id);
      const updates = payload.updates && typeof payload.updates === "object" ? payload.updates : {};
      const row = recommendedVideoUpdateRow(id, updates as Record<string, unknown>, await allowedRecommendedVideoCategories());
      const result = await rest(`recommended_videos?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
      if (!result.rows[0]) throw new Error("수정할 추천 영상을 찾을 수 없습니다.");
      return json(request, { ok: true, item: result.rows[0] });
    }
    if (action === "recommended-video-bulk-update") {
      const entries = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
      if (!entries.length || entries.length > 100) throw new Error("한 번에 저장할 추천 영상은 1개 이상 100개 이하여야 합니다.");
      const allowedCategories = await allowedRecommendedVideoCategories();
      const saved = await Promise.all(entries.map(async (entry) => {
        const id = text(entry.id);
        const updates = entry.updates && typeof entry.updates === "object" ? entry.updates as Record<string, unknown> : {};
        const row = recommendedVideoUpdateRow(id, updates, allowedCategories);
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
    if (action === "recommended-video-category-create") {
      const name = text(payload.name);
      const mainCategoryId = text(payload.mainCategoryId);
      const sortOrder = Number(payload.sortOrder);
      if (!name) throw new Error("추가할 하위 콘텐츠 이름을 입력해주세요.");
      if (!uuidPattern.test(mainCategoryId)) throw new Error("메인 카테고리를 선택해주세요.");
      if (text(payload.sortOrder) === "" || !Number.isInteger(sortOrder)) throw new Error("하위 콘텐츠 노출 순서는 정수로 입력해주세요.");
      const existing = await rest(`recommended_video_categories?select=id&name=eq.${encodeURIComponent(name)}&limit=1`);
      if (existing.rows.length) throw new Error("이미 등록된 하위 콘텐츠입니다.");
      const main = await rest(`recommended_video_main_categories?select=id&id=eq.${encodeURIComponent(mainCategoryId)}&limit=1`);
      if (!main.rows.length) throw new Error("연결할 메인 카테고리를 찾을 수 없습니다.");
      const result = await rest("recommended_video_categories", { method: "POST", body: JSON.stringify({ name, main_category_id: mainCategoryId, sort_order: sortOrder }), headers: { Prefer: "return=representation" } });
      return json(request, { ok: true, category: result.rows[0] });
    }
    if (action === "recommended-video-category-update") {
      const id = text(payload.id); const name = text(payload.name); const mainCategoryId = text(payload.mainCategoryId); const sortOrder = Number(payload.sortOrder);
      if (!uuidPattern.test(id)) throw new Error("하위 콘텐츠 ID가 올바르지 않습니다.");
      if (!name) throw new Error("하위 콘텐츠 이름을 입력해주세요.");
      if (!uuidPattern.test(mainCategoryId)) throw new Error("메인 카테고리를 선택해주세요.");
      if (!Number.isInteger(sortOrder)) throw new Error("하위 콘텐츠 노출 순서는 정수로 입력해주세요.");
      const result = await rest("rpc/hq_update_recommended_video_category", { method: "POST", body: JSON.stringify({ p_id: id, p_name: name, p_main_category_id: mainCategoryId, p_sort_order: sortOrder }) });
      return json(request, { ok: true, category: result.rows[0] || result.rows });
    }
    if (action === "recommended-video-category-delete") {
      const id = text(payload.id);
      if (!uuidPattern.test(id)) throw new Error("카테고리 ID가 올바르지 않습니다.");
      const result = await rest("rpc/hq_delete_recommended_video_category", { method: "POST", body: JSON.stringify({ p_id: id }) });
      return json(request, { ok: true, category: result.rows[0] || result.rows });
    }
    if (action === "recommended-video-main-category-create") {
      const name = text(payload.name); const sortOrder = Number(payload.sortOrder);
      if (!name) throw new Error("추가할 메인 카테고리 이름을 입력해주세요.");
      if (text(payload.sortOrder) === "" || !Number.isInteger(sortOrder)) throw new Error("메인 카테고리 순서는 정수로 입력해주세요.");
      const existing = await rest(`recommended_video_main_categories?select=id&name=eq.${encodeURIComponent(name)}&limit=1`);
      if (existing.rows.length) throw new Error("이미 등록된 메인 카테고리입니다.");
      const result = await rest("recommended_video_main_categories", { method: "POST", body: JSON.stringify({ name, sort_order: sortOrder }), headers: { Prefer: "return=representation" } });
      return json(request, { ok: true, category: result.rows[0] });
    }
    if (action === "recommended-video-main-category-update") {
      const id = text(payload.id); const name = text(payload.name); const sortOrder = Number(payload.sortOrder);
      if (!uuidPattern.test(id)) throw new Error("메인 카테고리 ID가 올바르지 않습니다.");
      if (!name) throw new Error("메인 카테고리 이름을 입력해주세요.");
      if (!Number.isInteger(sortOrder)) throw new Error("메인 카테고리 순서는 정수로 입력해주세요.");
      const result = await rest("rpc/hq_rename_recommended_video_main_category", { method: "POST", body: JSON.stringify({ p_id: id, p_name: name, p_sort_order: sortOrder }) });
      return json(request, { ok: true, category: result.rows[0] || result.rows });
    }
    if (action === "recommended-video-main-category-delete") {
      const id = text(payload.id);
      if (!uuidPattern.test(id)) throw new Error("메인 카테고리 ID가 올바르지 않습니다.");
      const result = await rest("rpc/hq_delete_recommended_video_main_category", { method: "POST", body: JSON.stringify({ p_id: id }) });
      return json(request, { ok: true, category: result.rows[0] || result.rows });
    }
    if (action === "recommended-video-add") {
      const youtubeUrl = text(payload.youtubeUrl);
      if (!youtubeUrl) throw new Error("추가할 YouTube 링크를 입력해주세요.");
      const result = await invokeFunction("recommended-videos", { youtube_url: youtubeUrl });
      return json(request, { ok: true, item: result.data || null });
    }
    if (action === "recommended-video-channel-sync") {
      const channelUrl = text(payload.channelUrl);
      const result = await invokeFunction("recommended-videos-channel-sync", channelUrl ? { channel_urls: [channelUrl] } : {});
      return json(request, { ok: true, totalInserted: Number(result.total_inserted || 0), channels: result.channels || [] });
    }
    if (action === "recommended-video-playlist-sync") {
      const playlistUrl = text(payload.playlistUrl);
      if (!playlistUrl) throw new Error("수집할 YouTube 플레이리스트 링크를 입력해주세요.");
      const result = await invokeFunction("recommended-videos-channel-sync", { playlist_urls: [playlistUrl] });
      return json(request, { ok: true, totalInserted: Number(result.total_inserted || 0), playlists: result.playlists || result.channels || [] });
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
