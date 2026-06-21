import { archiveItems, postypeItems, worldcups } from "./data";

// 실제 연동 시 이 파일의 함수 구현만 Google Sheets / Supabase 호출로 교체합니다.
export const archiveService = {
  async list() { return archiveItems; },
  async byMonth(year, month) { return archiveItems.filter((item) => item.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)); }
};

export const postypeService = { async search() { return postypeItems; } };
export const worldcupService = { async list() { return worldcups; } };
