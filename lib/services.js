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

export const archiveService = {
  async list({ fallback = true } = {}) {
    try {
      const result = await gasRequest("getMainData");
      const rows = [...(result.data || [])];
      if (rows.length && String(rows[0]?.[0] || "").includes("제목")) rows.shift();
      return { items: rows.map(mapRow).filter(Boolean), source: "google-sheets" };
    } catch (error) {
      if (!fallback) throw error;
      return { items: archiveItems, source: "dummy", error: error.message };
    }
  },
  async create(item) { return gasRequest("publish", { data: toSheetRow(item) }); },
  async update(oldLink, item) { return gasRequest("updateMain", { oldLink, newData: toSheetRow(item) }); },
  async remove(link) { return gasRequest("deleteMain", { link }); }
};

export const postypeService = { async search() { return postypeItems; } };
export const worldcupService = { async list() { return worldcups; } };
import { archiveItems, postypeItems, worldcups } from "./data";

// 실제 연동 시 이 파일의 함수 구현만 Google Sheets / Supabase 호출로 교체합니다.
export const archiveService = {
  async list() { return archiveItems; },
  async byMonth(year, month) { return archiveItems.filter((item) => item.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)); }
};

export const postypeService = { async search() { return postypeItems; } };
export const worldcupService = { async list() { return worldcups; } };
