import { archiveItems, postypeItems } from "./data";
import { adminRequest, supabaseRequest } from "./archive-supabase";
export { adminService, archiveService, keywordService, tweetMediaService } from "./archive-supabase";

export const GAS_WEB_APP_URL =
  process.env.NEXT_PUBLIC_ARCHIVE_GAS_URL ||
  "https://script.google.com/macros/s/AKfycbyVg2Dr7RQJpSVG10mXiwc9ecKs2t3K8hIqZ0AUw_D6dqGCENqhJEOvsQk0C6YXkDM1/exec";

const toDate = (value) => {
  const normalized = String(value || "").trim().replace(/[.\s/]/g, "-").replace(/-+/g, "-");
  const [year, month, day] = normalized.split("-");
  if (!year || !month || !day) return normalized;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const mapRow = (row, index) => {
  if (!row || !row[0]) return null;
  const [title, date, link, account, mainCategory, subCategory, keywords, thumbnailUrl] = row;
  return {
    id: `sheet-${index}-${String(link || title).slice(-12)}`,
    title: String(title || "").trim(),
    date: toDate(date),
    link: String(link || "").trim(),
    account: String(account || "").trim(),
    mainCategory: String(mainCategory || "기타").trim(),
    subCategory: String(subCategory || "기타").trim(),
    keywords: String(keywords || "").split(/[,#]/).map((word) => word.trim()).filter(Boolean),
    rawKeywords: String(keywords || "").trim(),
    thumbnailUrl: String(thumbnailUrl || "").trim()
  };
};

async function gasRequest(action, payload = {}) {
  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  if (!response.ok) throw new Error(`Google Sheets 연결 오류 (${response.status})`);
  const result = await response.json();
  if (result.status !== "success") throw new Error(result.message || "Google Sheets 요청에 실패했습니다.");
  return result;
}

const toSheetRow = (item) => [
  item.title,
  toDate(item.date),
  item.link || "",
  item.account || "",
  item.mainCategory || "기타",
  item.subCategory || "기타",
  item.rawKeywords || (item.keywords || []).join(", "),
  item.thumbnailUrl || ""
];

const rowsFrom = (result, offset = 0) => {
  const rows = [...(result.data || [])];
  if (rows.length && String(rows[0]?.[0] || "").includes("제목")) rows.shift();
  return rows.map((row, index) => mapRow(row, index + offset)).filter(Boolean);
};

const filterAndSort = (items, { query = "", mainCategory = "전체", subCategory = "전체", sortOrder = "desc" } = {}) => {
  const needle = query.replace(/^#/, "").trim().toLowerCase();
  return items.filter((item) =>
    (mainCategory === "전체" || item.mainCategory === mainCategory) &&
    (subCategory === "전체" || item.subCategory === subCategory) &&
    (!needle || [item.title, item.date, item.account, item.mainCategory, item.subCategory, item.rawKeywords].join(" ").toLowerCase().includes(needle))
  ).sort((a, b) => sortOrder === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
};

const legacyArchiveService = {
  async listAll() {
    const result = await gasRequest("getMainData");
    return { items: rowsFrom(result), source: "google-sheets" };
  },
  async list(options = {}) {
    return this.listAll(options);
  },
  async page({ page = 1, limit = 30, query = "", mainCategory = "전체", subCategory = "전체", sortOrder = "desc" } = {}) {
    try {
      const result = await gasRequest("getMainPage", { page, limit, query, mainCategory, subCategory, sortOrder });
      const items = rowsFrom(result, (page - 1) * limit);
      const total = Number(result.total ?? items.length);
      return { items, total, page, hasMore: result.hasMore ?? page * limit < total, source: "google-sheets-page" };
    } catch (pageError) {
      const full = await this.listAll();
      const filtered = filterAndSort(full.items, { query, mainCategory, subCategory, sortOrder });
      const start = (page - 1) * limit;
      return { items: filtered.slice(start, start + limit), total: filtered.length, page, hasMore: start + limit < filtered.length, source: "google-sheets-legacy", warning: pageError.message };
    }
  },
  async calendar({ year, month }) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    try {
      const result = await gasRequest("getCalendarData", { year, month });
      const items = rowsFrom(result);
      return { items, total: Number(result.total ?? items.length), source: "google-sheets-month" };
    } catch (pageError) {
      const full = await this.listAll();
      const items = full.items.filter((item) => item.date.startsWith(monthKey));
      return { items, total: items.length, source: "google-sheets-legacy", warning: pageError.message };
    }
  },
  async today({ monthDay }) {
    try {
      const result = await gasRequest("getTodayData", { monthDay });
      return { items: rowsFrom(result), source: "google-sheets-today" };
    } catch (pageError) {
      const full = await this.listAll();
      return { items: full.items.filter((item) => item.date.slice(5) === monthDay), source: "google-sheets-legacy", warning: pageError.message };
    }
  },
  async create(item) { return gasRequest("publish", { data: toSheetRow(item) }); },
  async update(oldLink, item) { return gasRequest("updateMain", { oldLink, newData: toSheetRow(item) }); },
  async remove(link) { return gasRequest("deleteMain", { link }); },
  async rawList() {
    const result = await gasRequest("getRawData");
    const rows = [...(result.data || [])];
    if (rows.length && String(rows[0]?.[0] || "").includes("제목")) rows.shift();
    return rows.map(mapRow).filter(Boolean);
  },
  async updateRaw(oldLink, item) { return gasRequest("updateRaw", { oldLink, newData: toSheetRow(item) }); },
  async removeRaw(link) { return gasRequest("deleteRaw", { link }); },
  async fetchTwitter({ twitterId, startDate, endDate }) {
    return gasRequest("fetchTwitter", { twitterId, startDate, endDate });
  }
};

const keywordTagsFrom = (items) => [...new Set(items.flatMap((item) => item.keywords || []))].filter(Boolean);

const legacyKeywordService = {
  async list(fallbackItems = []) {
    try {
      const result = await gasRequest("getKeywordData");
      const rows = [...(result.data || [])];
      if (rows.length && /키워드|제목/.test(String(rows[0]?.[0] || ""))) rows.shift();
      const items = rows.filter((row) => row?.length >= 3).map(mapRow).filter(Boolean);
      const tags = [...new Set(rows.flatMap((row) => String(row?.[0] || "").split(/[,#]/).map((tag) => tag.trim()).filter(Boolean)))];
      return {
        items: items.length ? items : fallbackItems.filter((item) => item.rawKeywords),
        tags: items.length ? keywordTagsFrom(items) : tags,
        source: "keyword-sheet"
      };
    } catch {
      const items = fallbackItems.filter((item) => item.rawKeywords || item.keywords?.length);
      return { items, tags: keywordTagsFrom(items), source: "main-sheet-fallback" };
    }
  }
};

export const postypeService = { async search() { return postypeItems; } };

const legacyTweetMediaService = {
  async resolve(sourceUrl) {
    if (!sourceUrl) return null;
    const result = await gasRequest("resolveTweetMedia", { sourceUrl });
    return result.data || null;
  }
};

const mapRecommendedVideo = (row) => ({
  id: row.id,
  youtubeId: String(row.youtube_id || ""),
  youtubeUrl: String(row.youtube_url || ""),
  title: String(row.title || ""),
  publishedAt: row.published_at || "",
  thumbnailUrl: String(row.thumbnail_url || ""),
  categories: Array.isArray(row.categories) ? row.categories : [],
  adminComment: String(row.admin_comment || ""),
  sortOrder: Number(row.sort_order ?? 9999),
  featuredOrder: Number(row.featured_order ?? 9999),
  isFeatured: Boolean(row.is_featured),
  isHyeopkwaePick: Boolean(row.is_hyeopkwae_pick),
  isActive: Boolean(row.is_active),
  channelId: String(row.channel_id || ""),
  channelTitle: String(row.channel_title || "")
});
const mapRecommendedVideoCategory = (row) => ({
  id: String(row.id || ""),
  name: String(row.name || ""),
  sortOrder: Number(row.sort_order ?? 9999),
  mainCategoryId: String(row.main_category_id || row.main_category?.id || ""),
  mainCategoryName: String(row.main_category?.name || ""),
  mainCategorySortOrder: Number(row.main_category?.sort_order ?? 9999),
  createdAt: row.created_at || ""
});
const mapRecommendedVideoMainCategory = (row) => ({
  id: String(row.id || ""),
  name: String(row.name || ""),
  sortOrder: Number(row.sort_order ?? 9999),
  isFallback: Boolean(row.is_fallback),
  createdAt: row.created_at || ""
});

export const recommendedVideoService = {
  async mainCategories() {
    const result = await supabaseRequest("recommended_video_main_categories?select=id,name,sort_order,is_fallback,created_at&order=sort_order.asc,created_at.asc,name.asc");
    return result.rows.map(mapRecommendedVideoMainCategory);
  },
  async categories() {
    const result = await supabaseRequest("recommended_video_categories?select=id,name,sort_order,created_at,main_category_id,main_category:recommended_video_main_categories(id,name,sort_order)&order=sort_order.asc,created_at.asc,name.asc");
    return result.rows.map(mapRecommendedVideoCategory);
  },
  async publicList() {
    const fields = "id,youtube_url,title,published_at,thumbnail_url,categories,sort_order,is_hyeopkwae_pick";
    const rows = [];
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const result = await supabaseRequest(`recommended_videos?select=${fields}&is_active=eq.true&order=sort_order.asc,published_at.desc.nullslast,id.asc&offset=${offset}&limit=${limit}`);
      rows.push(...result.rows);
      if (result.rows.length < limit) break;
    }
    return rows.map(mapRecommendedVideo);
  },
  async featuredList() {
    const fields = "id,youtube_url,title,published_at,thumbnail_url,categories,admin_comment,featured_order,is_hyeopkwae_pick";
    const result = await supabaseRequest(`recommended_videos?select=${fields}&is_active=eq.true&is_featured=eq.true&order=featured_order.asc,published_at.desc.nullslast&limit=10`);
    return result.rows.map(mapRecommendedVideo);
  },
  async list() {
    const items = [];
    const limit = 1000;
    let offset = 0;
    while (true) {
      const result = await adminRequest("recommended-video-list", { offset, limit });
      items.push(...result.items);
      if (!result.hasMore || !result.items.length) break;
      offset += result.items.length;
    }
    return items.map(mapRecommendedVideo);
  },
  async update(id, updates) {
    const result = await adminRequest("recommended-video-update", { id, updates });
    return mapRecommendedVideo(result.item);
  },
  async updateMany(items) {
    const saved = [];
    for (let index = 0; index < items.length; index += 100) {
      const result = await adminRequest("recommended-video-bulk-update", { items: items.slice(index, index + 100) });
      saved.push(...result.items.map(mapRecommendedVideo));
    }
    return saved;
  },
  async removeMany(ids) {
    let deletedCount = 0;
    for (let index = 0; index < ids.length; index += 100) {
      const result = await adminRequest("recommended-video-delete", { ids: ids.slice(index, index + 100) });
      deletedCount += Number(result.deletedCount || 0);
    }
    return deletedCount;
  },
  async createMainCategory(name, sortOrder) {
    const result = await adminRequest("recommended-video-main-category-create", { name, sortOrder });
    return mapRecommendedVideoMainCategory(result.category);
  },
  async updateMainCategory(id, name, sortOrder) {
    const result = await adminRequest("recommended-video-main-category-update", { id, name, sortOrder });
    return mapRecommendedVideoMainCategory(result.category);
  },
  async removeMainCategory(id) {
    const result = await adminRequest("recommended-video-main-category-delete", { id });
    return mapRecommendedVideoMainCategory(result.category);
  },
  async createCategory(name, mainCategoryId, sortOrder) {
    const result = await adminRequest("recommended-video-category-create", { name, mainCategoryId, sortOrder });
    return mapRecommendedVideoCategory(result.category);
  },
  async updateCategory(id, name, mainCategoryId, sortOrder) {
    const result = await adminRequest("recommended-video-category-update", { id, name, mainCategoryId, sortOrder });
    return mapRecommendedVideoCategory(result.category);
  },
  async removeCategory(id) {
    const result = await adminRequest("recommended-video-category-delete", { id });
    return mapRecommendedVideoCategory(result.category);
  },
  async addYoutubeUrl(youtubeUrl) {
    return adminRequest("recommended-video-add", { youtubeUrl });
  },
  async collectChannels(channelUrl = "") {
    return adminRequest("recommended-video-channel-sync", { channelUrl });
  },
  async collectPlaylist(playlistUrl = "") {
    return adminRequest("recommended-video-playlist-sync", { playlistUrl });
  }
};

const mapWorldcupCandidate = (row) => ({
  id: row.legacy_candidate_id || row.id,
  supabaseId: row.id,
  legacyCandidateId: row.legacy_candidate_id,
  name: String(row.name || ""),
  date: toDate(row.occurred_on),
  sourceUrl: String(row.source_url || ""),
  mediaUrl: String(row.media_url || ""),
  isVideo: row.media_type === "video",
  width: Number(row.width || 0),
  height: Number(row.height || 0),
  winCount: Number(row.win_count || 0)
});

const mapWorldcup = (row) => ({
  id: row.legacy_cup_id || row.id,
  supabaseId: row.id,
  legacyCupId: row.legacy_cup_id,
  title: String(row.title || ""),
  icon: String(row.icon || "🏆"),
  sortOrder: Number(row.sort_order || 0),
  candidateCount: Number(row.candidate_count || 0),
  items: []
});

export const worldcupService = {
  async list() {
    const [cupResult, candidateResult] = await Promise.all([
      supabaseRequest("hq_worldcup_public?select=*&order=sort_order.asc,id.asc"),
      supabaseRequest("hq_worldcup_candidates?select=*&is_active=eq.true&order=worldcup_id.asc,sort_order.asc,id.asc")
    ]);
    const candidatesByCup = new Map();
    candidateResult.rows.forEach((row) => {
      const items = candidatesByCup.get(String(row.worldcup_id)) || [];
      items.push(mapWorldcupCandidate(row));
      candidatesByCup.set(String(row.worldcup_id), items);
    });
    return cupResult.rows.map((row) => {
      const cup = mapWorldcup(row);
      cup.items = candidatesByCup.get(String(cup.supabaseId)) || [];
      cup.candidateCount = cup.items.length;
      return cup;
    });
  },
  async save(cup) {
    const result = await adminRequest("worldcup-save", { cup }, { functionName: "hq-worldcup-admin" });
    return result.cup;
  },
  async remove(id) {
    await adminRequest("worldcup-delete", { id }, { functionName: "hq-worldcup-admin" });
    return true;
  },
  async incrementWin(candidateId) {
    const result = await supabaseRequest("rpc/hq_record_worldcup_win", { method: "POST", body: { p_candidate_id: Number(candidateId) } });
    return Number(result.rows || 0);
  },
};
