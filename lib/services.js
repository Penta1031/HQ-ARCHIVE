import { archiveItems, postypeItems, worldcups } from "./data";

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

export const archiveService = {
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

export const keywordService = {
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
export const worldcupService = { async list() { return worldcups; } };
