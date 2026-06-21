export const SUPABASE_URL = String(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aiuwbwtknaceghkzporx.supabase.co"
).replace(/\/$/, "");

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdXdid3RrbmFjZWdoa3pwb3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjM0MTEsImV4cCI6MjA5NzA5OTQxMX0.8SRwD8aS_UiPHMKsLw6O5wIZo4rc-Ep5bT3MljmQHIE";

const ADMIN_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/hq-archive-admin`;
const MEDIA_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/hq-twitter-media`;
const ADMIN_SESSION_KEY = "hq-archive-admin-session";

const clean = (value) => String(value ?? "").trim();
const escapeLike = (value) => clean(value).replace(/[,*()]/g, " ");
const toDate = (value) => {
  const normalized = clean(value).replace(/\s+/g, "").replace(/[./]/g, "-");
  const short = normalized.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (short) return `20${short[1]}-${short[2]}-${short[3]}`;
  const full = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return full ? `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}` : normalized;
};

async function supabaseRequest(resource, { method = "GET", body, count = false } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(count ? { Prefer: "count=exact" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`Supabase 연결 오류 (${response.status})`);
  const rows = response.status === 204 ? [] : await response.json();
  const total = Number((response.headers.get("content-range") || "").split("/")[1] || (Array.isArray(rows) ? rows.length : 1));
  return { rows, total };
}

function adminToken() {
  return typeof window === "undefined" ? "" : window.sessionStorage.getItem(ADMIN_SESSION_KEY) || "";
}

async function adminRequest(action, payload = {}, { allowAnonymous = false } = {}) {
  const response = await fetch(ADMIN_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(allowAnonymous ? {} : { "x-hq-admin-session": adminToken() })
    },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    throw new Error(result.error || `관리자 요청 오류 (${response.status})`);
  }
  return result;
}

const mapArchive = (row) => ({
  id: row.id,
  title: clean(row.title),
  date: toDate(row.occurred_on),
  link: clean(row.source_url),
  account: clean(row.account),
  mainCategory: clean(row.main_category || row.mainCategory),
  subCategory: clean(row.sub_category || row.subCategory),
  keywords: Array.isArray(row.keywords) ? row.keywords : [],
  rawKeywords: Array.isArray(row.keywords) ? row.keywords.join(", ") : "",
  thumbnailUrl: clean(row.thumbnail_url || row.thumbnailUrl),
  status: row.status || "published"
});

function archiveParams({ page = 1, limit = 30, query = "", mainCategory = "전체", subCategory = "전체", sortOrder = "desc", dateFrom = "", dateTo = "" } = {}) {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  const params = new URLSearchParams({
    select: "*",
    order: `occurred_on.${direction}.nullslast,id.${direction}`,
    offset: String((page - 1) * limit),
    limit: String(limit)
  });
  if (mainCategory && mainCategory !== "전체") params.set("main_category", `eq.${mainCategory}`);
  if (subCategory && subCategory !== "전체") params.set("sub_category", `eq.${subCategory}`);
  if (dateFrom) params.set("occurred_on", `gte.${dateFrom}`);
  if (dateTo) params.append("occurred_on", `lte.${dateTo}`);
  const needle = escapeLike(query.replace(/^#/, ""));
  if (needle) {
    if (query.startsWith("#")) params.set("keywords", `cs.{${needle}}`);
    else params.set("or", `(title.ilike.*${needle}*,account.ilike.*${needle}*,source_url.ilike.*${needle}*)`);
  }
  return params;
}

export const adminService = {
  async login(password) {
    const result = await adminRequest("login", { password }, { allowAnonymous: true });
    if (typeof window !== "undefined") window.sessionStorage.setItem(ADMIN_SESSION_KEY, result.token);
    return true;
  },
  logout() {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  },
  hasSession() {
    return Boolean(adminToken());
  }
};

export const archiveService = {
  async page(options = {}) {
    const page = options.page || 1;
    const limit = Math.min(60, Math.max(1, options.limit || 30));
    const result = await supabaseRequest(`hq_archive_public?${archiveParams({ ...options, page, limit })}`, { count: true });
    return { items: result.rows.map(mapArchive), total: result.total, page, hasMore: page * limit < result.total, source: "supabase" };
  },
  async list(options = {}) {
    return this.page(options);
  },
  async calendar({ year, month }) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const result = await supabaseRequest(`hq_archive_public?${archiveParams({ page: 1, limit: 1000, dateFrom: start, dateTo: end })}`, { count: true });
    return { items: result.rows.map(mapArchive), total: result.total, source: "supabase-month" };
  },
  async today({ monthDay, page = 1, limit = 30 }) {
    const result = await supabaseRequest("rpc/hq_archive_today", { method: "POST", body: { p_month_day: monthDay, p_offset: (page - 1) * limit, p_limit: limit } });
    return { items: result.rows.map(mapArchive), total: Number(result.rows[0]?.total_count || result.rows.length), source: "supabase-today" };
  },
  async adminPage(options = {}) {
    return adminRequest("archive-list", options);
  },
  async create(item, status = "published") {
    return adminRequest("archive-create", { item, status });
  },
  async update(id, item) {
    return adminRequest("archive-update", { id, item });
  },
  async remove(id) {
    return adminRequest("archive-delete", { id });
  },
  async rawList(options = {}) {
    const result = await adminRequest("archive-list", { ...options, status: "draft", page: options.page || 1, limit: options.limit || 100 });
    return result.items;
  },
  async updateRaw(id, item) {
    return adminRequest("archive-update", { id, item: { ...item, status: "draft" } });
  },
  async removeRaw(id) {
    return adminRequest("archive-delete", { id });
  },
  async publishRaw(id) {
    return adminRequest("archive-publish", { id });
  },
  async fetchTwitter({ twitterId, startDate, endDate }) {
    const result = await adminRequest("twitter-search", { twitterId, startDate, endDate });
    if (result.items?.length) await adminRequest("archive-save-drafts", { items: result.items });
    return { count: result.items?.length || 0 };
  }
};

export const keywordService = {
  async list() {
    const [tags, items] = await Promise.all([
      supabaseRequest("hq_archive_keywords?select=name&is_active=eq.true&order=sort_order.asc"),
      supabaseRequest("hq_archive_public?select=*&keywords=not.eq.{}&order=occurred_on.desc.nullslast&limit=200")
    ]);
    return { tags: tags.rows.map((row) => row.name), items: items.rows.map(mapArchive), source: "supabase" };
  }
};

export const tweetMediaService = {
  async resolve(sourceUrl) {
    if (!sourceUrl) return null;
    const response = await fetch(MEDIA_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ sourceUrl })
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.ok ? result.data : null;
  }
};
