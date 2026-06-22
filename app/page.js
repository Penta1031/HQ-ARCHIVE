"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive, Bookmark, CalendarDays, ChevronLeft, ChevronRight, Crown, Flame, Heart,
  ArrowUpDown, ExternalLink, Home, Languages, LockKeyhole, Medal, Pencil, Play, Plus, RefreshCw, Search, Share2, Shuffle, Trash2, Trophy, Video, X
} from "lucide-react";
import { adminService, archiveService, keywordService, recommendedVideoService, tweetMediaService, worldcupService } from "../lib/services";
import { ARCHIVE_LANGUAGE_OPTIONS, archiveCategoryLabel, archiveKeywordLabel, archiveText } from "../lib/archive-i18n";

const pad = (n) => String(n).padStart(2, "0");
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const getKstDate = (date = new Date()) => {
  const parts = Object.fromEntries(KST_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
function useKstToday() {
  const [date, setDate] = useState("");
  useEffect(() => {
    const sync = () => setDate((current) => {
      const next = getKstDate();
      return current === next ? current : next;
    });
    sync();
    const timer = window.setInterval(sync, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  return date;
}
const cn = (...classes) => classes.filter(Boolean).join(" ");
const MAIN_CATEGORY_ORDER = ["전체", "무대영상", "라이브", "유튜브", "미디어", "SNS", "메시지", "기타"];
const CATEGORY_MAP = {
  "무대영상": ["음악방송", "직캠", "콘서트", "페스티벌", "대학축제", "버스킹", "쇼케이스", "팬미팅", "팬싸인회", "공항/퇴근길", "해외투어", "킹덤"],
  "라이브": ["하루의 마무리", "승협이 라이브", "승구리당당", "우리 얘기 좀 합시다", "개인 라이브", "단체 라이브", "인스타그램 라이브", "기타 라이브"],
  "유튜브": ["뮤직비디오", "메이킹", "비하인드", "레코딩로그", "승캠", "승협이", "합주일지", "커버곡", "스페셜클립", "쇼츠", "엔킷리스트", "버킷리스트", "냉탕과온탕사이"],
  "미디어": ["방송/예능", "뮤직웨이브", "라디오", "인터뷰", "잡지/화보", "웹예능/웹컨텐츠"],
  "SNS": ["공식 트위터", "개인 인스타그램", "공식 인스타그램", "릴스", "틱톡", "공식 카페", "공식 블로그"],
  "메시지": ["버블", "프롬"],
  "기타": ["연말결산", "기타", "백업", "목격담", "모음집"]
};
const SUB_CATEGORY_OPTIONS = Object.values(CATEGORY_MAP).flat();
const mainCategoryFor = (subCategory) => Object.entries(CATEGORY_MAP).find(([, values]) => values.includes(subCategory))?.[0] || "기타";

export default function Page() {
  const [tab, setTab] = useState("home");
  const [archiveLanguage, setArchiveLanguage] = useState("ko");
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [postypeAdminRequest, setPostypeAdminRequest] = useState(0);
  const navigate = (next, keyword = "") => { setTab(next); setSelectedKeyword(keyword); };
  const openAdmin = () => { setAdminOpen(true); };
  const closeAdmin = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setAdminOpen(false);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  };
  const openPostypeAdmin = (credential = "") => {
    closeAdmin();
    setTab("postype");
    setPostypeAdminRequest({ id: Date.now(), credential });
  };

  return (
    <main className="min-h-screen bg-neutral-950 md:bg-[#111]">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-x border-white/5 bg-black shadow-2xl">
        <Header onAdmin={openAdmin} showLanguage={tab === "home"} language={archiveLanguage} onLanguage={setArchiveLanguage} />
        <section className={cn("min-h-0 flex-1 overscroll-contain no-scrollbar", tab === "postype" ? "overflow-hidden pb-[76px]" : "overflow-y-auto pb-28")}>
          <div key={tab} className={cn("animate-fade-in", tab === "postype" && "h-full")}>
            {tab === "home" && <HomeView language={archiveLanguage} initialKeyword={selectedKeyword} onKeywordConsumed={() => setSelectedKeyword("")} />}
            {tab === "calendar" && <CalendarView />}
            {tab === "recommended" && <RecommendedView />}
            {tab === "postype" && <PostypeView adminRequest={postypeAdminRequest} />}
          </div>
        </section>
        <BottomNav tab={tab} onChange={navigate} />
        {adminOpen && <AdminHub onClose={closeAdmin} onOpenPostype={openPostypeAdmin} />}
      </div>
    </main>
  );
}

function Header({ onAdmin, showLanguage = false, language = "ko", onLanguage }) {
  const [languageOpen, setLanguageOpen] = useState(false);
  useEffect(() => { if (!showLanguage) setLanguageOpen(false); }, [showLanguage]);
  return (
    <header className="relative z-30 flex h-[58px] shrink-0 items-center border-b border-white/10 bg-black/90 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_14px_#e50000]" />
        <h1 className="text-[16px] font-black tracking-[-.03em]">HQ ARCHIVE</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {showLanguage && <div className="relative">
          <button onClick={() => setLanguageOpen((open) => !open)} aria-label="아카이브 번역" aria-expanded={languageOpen} className={cn("rounded-xl border p-2 transition", languageOpen ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 bg-white/5 text-neutral-500")}><Languages size={16}/></button>
          {languageOpen && <div className="absolute right-0 top-11 z-50 flex gap-1 rounded-xl border border-white/10 bg-neutral-950 p-1.5 shadow-2xl">
            {ARCHIVE_LANGUAGE_OPTIONS.map((option) => <button key={option.code} onClick={() => { onLanguage(option.code); setLanguageOpen(false); }} aria-label={option.label} title={option.label} className={cn("flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[10px] font-black", language === option.code ? "bg-accent text-white" : "bg-white/5 text-neutral-400")}>{option.short}</button>)}
          </div>}
        </div>}
        <button onClick={() => window.location.reload()} aria-label="데이터 새로고침" title="데이터 새로고침" className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-500 transition active:text-accent"><RefreshCw size={16}/></button>
        <button onClick={onAdmin} aria-label="관리자 모드" className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-500 transition active:text-accent"><LockKeyhole size={16} /></button>
      </div>
    </header>
  );
}

function SearchBar({ value, onChange, placeholder = "제목, 키워드, 날짜로 검색" }) {
  return (
    <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 focus-within:border-accent/70">
      <Search size={17} className="shrink-0 text-neutral-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-neutral-600" />
      {value && <button onClick={() => onChange("")} aria-label="검색어 지우기"><X size={15} className="text-neutral-500" /></button>}
    </label>
  );
}

function HomeView({ language = "ko", initialKeyword, onKeywordConsumed }) {
  const [subTab, setSubTab] = useState("archive");
  const [query, setQuery] = useState(initialKeyword ? `#${initialKeyword}` : "");
  const [requestQuery, setRequestQuery] = useState(initialKeyword ? `#${initialKeyword}` : "");
  const [mainCategory, setMainCategory] = useState("전체");
  const [subCategory, setSubCategory] = useState("전체");
  const [sortOrder, setSortOrder] = useState("desc");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [keywordData, setKeywordData] = useState({ items: [], tags: [] });
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [keywordLoaded, setKeywordLoaded] = useState(false);
  const [todayItems, setTodayItems] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayLoadedDate, setTodayLoadedDate] = useState("");
  const [randomItem, setRandomItem] = useState(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const todayDate = useKstToday();
  const t = (key, values) => archiveText(language, key, values);
  const categoryLabel = (value) => archiveCategoryLabel(language, value);
  const mains = MAIN_CATEGORY_ORDER;
  const subs = ["전체", ...(mainCategory === "전체" ? SUB_CATEGORY_OPTIONS : (CATEGORY_MAP[mainCategory] || []))];

  useEffect(() => { const timer = setTimeout(() => setRequestQuery(query), 350); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setItems([]); setPage(1);
    archiveService.page({ page: 1, limit: 30, query: requestQuery, mainCategory, subCategory, sortOrder })
      .then((result) => { if (!active) return; setItems(result.items); setTotal(result.total); setHasMore(result.hasMore); })
      .catch((reason) => { if (!active) return; setError(reason.message || "기록을 불러오지 못했어요."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestQuery, mainCategory, subCategory, sortOrder]);
  useEffect(() => {
    if (subTab !== "keywords" || keywordLoaded || keywordLoading) return;
    setKeywordLoading(true);
    keywordService.list().then(setKeywordData).catch(() => setKeywordData({items:[],tags:[]})).finally(() => { setKeywordLoading(false); setKeywordLoaded(true); });
  }, [subTab, keywordLoaded, keywordLoading]);
  useEffect(() => {
    if (!todayDate || subTab !== "today" || todayLoadedDate === todayDate || todayLoading) return;
    const requestedDate = todayDate;
    setTodayLoading(true);
    archiveService.today({ monthDay: requestedDate.slice(5) }).then((result) => setTodayItems(result.items.filter((item) => item.date !== requestedDate))).catch(() => setTodayItems([])).finally(() => { setTodayLoading(false); setTodayLoadedDate(requestedDate); });
  }, [subTab, todayDate, todayLoadedDate, todayLoading]);
  useEffect(() => { if (initialKeyword) { setQuery(`#${initialKeyword}`); setSubTab("archive"); onKeywordConsumed(); } }, [initialKeyword, onKeywordConsumed]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try { const result = await archiveService.page({ page: page + 1, limit: 30, query: requestQuery, mainCategory, subCategory, sortOrder }); setItems((current) => [...current, ...result.items]); setPage(result.page); setHasMore(result.hasMore); setTotal(result.total); }
    catch (reason) { setError(reason.message || "다음 기록을 불러오지 못했어요."); }
    finally { setLoadingMore(false); }
  };

  const pickRandom = async () => {
    if (!total || randomLoading) return;
    setRandomLoading(true);
    try {
      const result = await archiveService.page({ page: Math.floor(Math.random() * total) + 1, limit: 1, query: requestQuery, mainCategory, subCategory, sortOrder });
      setRandomItem(result.items[0] || null);
    } catch (reason) {
      setError(reason.message || "랜덤 기록을 불러오지 못했어요.");
    } finally {
      setRandomLoading(false);
    }
  };

  const pickKeyword = (tag) => { setQuery(`#${tag}`); setSubTab("archive"); onKeywordConsumed(); };
  return (
    <div>
      <div className="px-4 pt-4"><SearchBar value={query} onChange={setQuery} placeholder={t("searchPlaceholder")} /></div>
      <div className="sticky top-0 z-20 mt-3 border-b border-white/10 bg-black/95 px-4 backdrop-blur-xl">
        <div className="grid grid-cols-3">
          {[["archive", Archive, t("archive")], ["keywords", Heart, t("keywords")], ["today", CalendarDays, t("today")]].map(([key, Icon, label]) => (
            <button key={key} onClick={() => setSubTab(key)} className={cn("relative py-3 text-[13px] font-bold transition", subTab === key ? "text-white" : "text-neutral-600")}>
              <span className="flex items-center justify-center gap-1.5"><Icon size={14}/>{label}</span>{subTab === key && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>
      {subTab === "archive" && <div className="px-4 pt-4">
        <p className="mb-2 text-[10px] font-bold text-neutral-600">{t("categoryHint")}</p>
        <FilterRow values={mains} active={mainCategory} onChange={(v) => { setMainCategory(v); setSubCategory("전체"); }} getLabel={categoryLabel} />
        {mainCategory !== "전체" && <div className="mt-3"><FilterRow values={subs} active={subCategory} onChange={setSubCategory} getLabel={categoryLabel} secondary /></div>}
        <SectionLabel label={t("all")} count={total} unit={t("unit")} sortOrder={sortOrder} sortLabels={{ desc: t("latest"), asc: t("oldest") }} onSort={() => setSortOrder((order) => order === "desc" ? "asc" : "desc")} />
        {loading ? <ArchiveSkeleton /> : error && !items.length ? <LoadError message={error}/> : <ArchiveGrid items={items} categoryLabel={categoryLabel} emptyText={t("empty")} />}
        {hasMore && !loading && <button disabled={loadingMore} onClick={loadMore} className="mt-6 w-full rounded-xl border border-white/10 bg-neutral-900 py-3 text-xs font-bold text-neutral-400 disabled:opacity-60">{loadingMore ? t("loadingMore") : t("more")}</button>}
      </div>}
      {subTab === "keywords" && (keywordLoading ? <div className="px-4 pt-5"><ArchiveSkeleton/></div> : <KeywordView items={keywordData.items} tags={keywordData.tags} query={query} language={language} />)}
      {subTab === "today" && <TodayView items={todayItems} loading={todayLoading} todayDate={todayDate} language={language} />}
      {subTab === "archive" && <FloatingPortal><button disabled={randomLoading || !total} onClick={pickRandom} className="fixed bottom-24 right-4 z-30 flex min-h-10 items-center gap-1.5 rounded-full border border-accent/40 bg-[#120000]/95 px-4 text-[11px] font-black text-[#ff5a5a] shadow-[0_10px_30px_rgba(0,0,0,.38)] backdrop-blur-md transition active:border-accent active:bg-accent active:text-white disabled:opacity-50 md:right-[calc((100vw-28rem)/2+1rem)]"><Shuffle size={13}/>{t("random")}</button></FloatingPortal>}
      {randomItem && <RandomArchiveModal item={randomItem} language={language} onAgain={pickRandom} loading={randomLoading} onClose={() => setRandomItem(null)} />}
    </div>
  );
}

function FloatingPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

function RandomArchiveModal({ item, language = "ko", onAgain, loading = false, onClose }) {
  const t = (key) => archiveText(language, key);
  const categoryLabel = (value) => archiveCategoryLabel(language, value);
  return <AppOverlay className="z-[75]"><div onClick={onClose} className="flex h-full items-end justify-center bg-black/80 p-3 backdrop-blur-md"><div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[28px] border border-white/10 bg-neutral-950 p-5 shadow-2xl animate-pop-in">
    <div className="flex items-center"><h2 className="text-xl font-black">{t("randomTitle")}</h2><button onClick={onClose} aria-label="랜덤 추천 닫기" className="ml-auto rounded-full bg-white/5 p-2 text-neutral-500"><X size={18}/></button></div>
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="aspect-video w-full object-cover"/> : <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800"><Archive size={28} className="text-neutral-700"/></div>}<div className="p-4"><div className="flex items-center text-[10px] font-bold"><span className="rounded border border-accent/60 px-1.5 py-0.5 text-accent">{categoryLabel(item.subCategory)}</span><time className="ml-auto text-neutral-600">{item.date}</time></div><h3 className="mt-3 text-sm font-black leading-6">{item.title}</h3></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={loading} onClick={onAgain} className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-xs font-black text-neutral-300 disabled:opacity-50"><Shuffle size={14}/>{t("randomAgain")}</button>{item.link ? <a href={item.link} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-xs font-black"><ExternalLink size={14}/>{t("openOriginal")}</a> : <button disabled className="rounded-xl bg-neutral-900 py-3 text-xs font-black text-neutral-700">{t("openOriginal")}</button>}</div>
  </div></div></AppOverlay>;
}

function FilterRow({ values, active, onChange, secondary = false, getLabel = (value) => value }) {
  return <div className={cn("flex gap-2", secondary ? "flex-wrap" : "-mx-4 overflow-x-auto px-4 no-scrollbar")}>{values.map((value) => (
    <button key={value} onClick={() => onChange(value)} className={cn("shrink-0 font-bold transition", secondary ? "rounded-md px-2 py-1 text-[10px] leading-none" : "rounded-full px-3 py-2 text-xs", active === value ? (secondary ? "bg-accent text-white" : "border border-white/30 bg-neutral-800 text-white") : "border border-white/10 bg-neutral-900 text-neutral-500")}>{getLabel(value)}</button>
  ))}</div>;
}

function SectionLabel({ label, count, unit = "개", sortOrder, sortLabels = { desc: "최신순", asc: "과거순" }, onSort }) {
  return <div className="mb-3 mt-6 flex items-center gap-3"><p className="text-xs text-neutral-400">{label} <b className="text-white">{count}{unit}</b></p>{onSort && <button onClick={onSort} className="ml-auto flex items-center gap-1 text-xs font-bold text-neutral-400"><ArrowUpDown size={13}/>{sortOrder === "desc" ? sortLabels.desc : sortLabels.asc}</button>}</div>;
}

function ArchiveGrid({ items, categoryLabel, emptyText = "조건에 맞는 기록이 없어요." }) {
  if (!items.length) return <EmptyState text={emptyText} />;
  return <div className="grid grid-cols-2 gap-x-3 gap-y-5">{items.map((item, index) => <ArchiveCard key={item.id} item={item} index={index} categoryLabel={categoryLabel} />)}</div>;
}

function ArchiveCard({ item, index = 0, categoryLabel = (value) => value }) {
  return <article onClick={() => item.link && window.open(item.link, "_blank", "noopener,noreferrer")} className={cn("group min-w-0 animate-fade-in", item.link && "cursor-pointer")} style={{ animationDelay: `${index * 35}ms` }}>
    <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-neutral-900">
      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-active:scale-105" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800"><Archive size={22} className="text-neutral-700" /></div>}
    </div>
    <div className="mt-2 flex items-center gap-2 text-[9px] font-bold"><span className="rounded border border-accent/60 px-1 py-px leading-none text-accent">{categoryLabel(item.subCategory)}</span><time className="ml-auto whitespace-nowrap text-neutral-600">{item.date}</time></div>
    <h3 className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-[1.45] tracking-[-.02em]">{item.title}</h3>
  </article>;
}

function KeywordView({ items, tags, query, language = "ko" }) {
  const [active, setActive] = useState("전체");
  const [sortOrder, setSortOrder] = useState("desc");
  const [displayLimit, setDisplayLimit] = useState(30);
  const t = (key) => archiveText(language, key);
  const keywordLabel = (value) => value === "전체" ? t("all") : archiveKeywordLabel(language, value);
  const categoryLabel = (value) => archiveCategoryLabel(language, value);
  const filtered = items.filter((item) => (active === "전체" || item.keywords?.includes(active) || item.rawKeywords === active) && (!query || [item.title, item.date, ...(item.keywords || [])].join(" ").toLowerCase().includes(query.replace(/^#/, "").toLowerCase()))).sort((a,b) => sortOrder === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  return <div className="px-4 pb-6 pt-4">
    <p className="mb-2 text-[10px] font-bold text-neutral-600">{t("keywordHint")}</p>
    <FilterRow values={["전체", ...tags]} active={active} onChange={(value) => { setActive(value); setDisplayLimit(30); }} getLabel={keywordLabel}/>
    <SectionLabel label={keywordLabel(active)} count={filtered.length} unit={t("unit")} sortOrder={sortOrder} sortLabels={{ desc: t("latest"), asc: t("oldest") }} onSort={() => setSortOrder((order) => order === "desc" ? "asc" : "desc")}/>
    <ArchiveGrid items={filtered.slice(0, displayLimit)} categoryLabel={categoryLabel} emptyText={t("empty")}/>
    {filtered.length > displayLimit && <button onClick={() => setDisplayLimit((limit) => limit + 30)} className="mt-6 w-full rounded-xl border border-white/10 bg-neutral-900 py-3 text-xs font-bold text-neutral-400">{t("more")}</button>}
  </div>;
}

function TodayView({ items, loading = false, todayDate = "", language = "ko" }) {
  const [year, month, day] = (todayDate || "0-0-0").split("-").map(Number);
  return <div className="px-4 pt-5"><div className="relative overflow-hidden rounded-3xl bg-accent p-5"><div className="absolute -right-6 -top-8 text-[100px] font-black text-white/10">{day || ""}</div><p className="text-xs font-bold text-white/70">ON THIS DAY</p><h2 className="mt-2 text-2xl font-black">{todayDate ? archiveText(language, "todayTitle", { month, day }) : archiveText(language, "today")}</h2></div>
    {loading ? <div className="mt-6"><ListSkeleton/></div> : <div className="mt-6 space-y-3">{items.map((item) => { const ago = year - Number(item.date.slice(0, 4)); return <article key={item.id} onClick={() => item.link && window.open(item.link, "_blank", "noopener,noreferrer")} onKeyDown={(event) => { if (item.link && (event.key === "Enter" || event.key === " ")) window.open(item.link, "_blank", "noopener,noreferrer"); }} role={item.link ? "link" : undefined} tabIndex={item.link ? 0 : undefined} className={cn("flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/70 p-3 transition", item.link && "cursor-pointer active:border-accent/60")}><img src={item.thumbnailUrl} alt="" className="h-16 w-14 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex items-center"><time className="text-[10px] font-bold text-neutral-500">{item.date}</time><span className="ml-auto rounded-full bg-accent/15 px-2 py-1 text-[10px] font-black text-accent">{archiveText(language, "yearsAgo", { years: ago })}</span></div><h3 className="mt-2 truncate text-[13px] font-bold">{item.title}</h3></div></article>; })}</div>}
  </div>;
}

function CalendarView() {
  const [year, setYear] = useState(2026); const [month, setMonth] = useState(6); const [day, setDay] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(30);
  const [monthly, setMonthly] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const monthKey = `${year}-${pad(month)}`;
  const filtered = (day ? monthly.filter((x) => x.date === `${monthKey}-${pad(day)}`) : monthly).sort((a,b) => b.date.localeCompare(a.date));
  const firstDay = new Date(year, month - 1, 1).getDay(); const days = new Date(year, month, 0).getDate();
  const changeMonth = (delta) => { const d = new Date(year, month - 1 + delta, 1); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setDay(null); setDisplayLimit(30); };
  useEffect(() => { let active = true; setLoading(true); setError(""); setMonthly([]); archiveService.calendar({year,month}).then((result)=>{if(!active)return;setMonthly(result.items);setMonthTotal(result.total);}).catch((reason)=>{if(!active)return;setError(reason.message||"캘린더 기록을 불러오지 못했어요.");}).finally(()=>{if(active)setLoading(false);}); return()=>{active=false;}; },[year,month]);
  return <div className="px-4 pt-4"><div className="flex items-center"><h2 className="text-2xl font-black tracking-tight">캘린더</h2><span className="ml-auto text-sm font-black text-neutral-500">{monthTotal}개</span></div>
    <div className="mt-5 rounded-3xl border border-white/10 bg-neutral-900/70 p-4">
      <div className="flex items-center justify-between"><button onClick={() => changeMonth(-1)} className="rounded-full bg-white/5 p-2"><ChevronLeft size={17} /></button><div className="flex gap-2"><select value={year} onChange={(e) => { setYear(+e.target.value); setDay(null); setDisplayLimit(30); }} className="rounded-lg bg-black px-2 py-1.5 text-sm font-black outline-none">{Array.from({length:12},(_,i)=>2017+i).map((y) => <option key={y}>{y}</option>)}</select><select value={month} onChange={(e) => { setMonth(+e.target.value); setDay(null); setDisplayLimit(30); }} className="rounded-lg bg-black px-2 py-1.5 text-sm font-black outline-none">{Array.from({length:12},(_,i)=>i+1).map((m) => <option key={m} value={m}>{pad(m)}</option>)}</select></div><button onClick={() => changeMonth(1)} className="rounded-full bg-white/5 p-2"><ChevronRight size={17} /></button></div>
      <div className="mt-5 grid grid-cols-7 text-center text-[10px] font-bold text-neutral-600">{["일","월","화","수","목","금","토"].map((x)=><span key={x}>{x}</span>)}</div>
      <div className="mt-2 grid grid-cols-7 gap-y-1">{Array.from({length:firstDay}).map((_,i)=><span key={`e${i}`} />)}{Array.from({length:days},(_,i)=>i+1).map((d)=>{const has=monthly.some((x)=>x.date===`${monthKey}-${pad(d)}`); return <button key={d} onClick={()=>{setDay(day===d?null:d);setDisplayLimit(30);}} className={cn("relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",day===d?"bg-accent text-white":d===21&&month===6&&year===2026?"bg-white text-black":"text-neutral-400")}>{d}{has&&day!==d&&<span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent"/>}</button>})}</div>
    </div>
    <div className="mt-6 flex items-end"><div><p className="text-[10px] font-black tracking-[.18em] text-neutral-600">{day ? "SELECTED DAY" : "MONTHLY ARCHIVE"}</p><h3 className="mt-1 text-lg font-black">{day ? `${month}월 ${day}일` : `${year}년 ${month}월`}</h3></div><button onClick={()=>{setDay(null);setDisplayLimit(30);}} className={cn("ml-auto text-xs font-bold text-accent",!day&&"invisible")}>전체 보기</button></div>
    <div className="mt-4">{loading ? <ArchiveSkeleton/> : error ? <LoadError message={error}/> : <ArchiveGrid items={filtered.slice(0, displayLimit)} />}{!loading && filtered.length > displayLimit && <button onClick={() => setDisplayLimit((limit) => limit + 30)} className="mt-6 w-full rounded-xl border border-white/10 bg-neutral-900 py-3 text-xs font-bold text-neutral-400">더보기 (+30)</button>}</div>
  </div>;
}

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const itemKey = (item) => `${item.originalCupId || "cup"}-${item.id}`;
const tweetMediaCache = new Map();

function AppOverlay({ children, className = "z-[70]" }) {
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  return mounted ? createPortal(<div className={cn("fixed inset-0",className)}>{children}</div>,document.body) : null;
}

const mediaFromTweetData = (data = {}) => {
  const asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const vxMedia = asArray(data.mediaURLs)[0] || asArray(data.media_urls)[0];
  const vxUrl = typeof vxMedia === "string" ? vxMedia : vxMedia?.url || "";
  if (vxUrl) return { url: vxUrl, isVideo: /video\.twimg\.com|\.(mp4|m3u8)(?:$|\?)/i.test(vxUrl) };
  const candidates = [
    ...asArray(data.media_extended),
    ...asArray(data.tweet?.media?.all),
    ...asArray(data.media?.all)
  ];
  const detailed = candidates.find((media)=>/video|gif/i.test(media?.type || "") && (media?.url || media?.thumbnail_url))
    || candidates.find((media)=>media?.url || media?.thumbnail_url);
  const url = detailed?.url || detailed?.thumbnail_url || data.video_url || data.tweet?.video?.url || "";
  return url ? { url, isVideo: /video|gif/i.test(detailed?.type || "") || /\.(mp4|m3u8)(?:$|\?)/i.test(url) } : null;
};

async function resolveTweetMedia(sourceUrl) {
  if (!sourceUrl) return null;
  if (tweetMediaCache.has(sourceUrl)) return tweetMediaCache.get(sourceUrl);
  const request = (async()=>{
    try {
      const source = new URL(sourceUrl);
      if (/pbs\.twimg\.com|video\.twimg\.com/i.test(source.hostname)) return { url: sourceUrl, isVideo: /video\.twimg\.com|\.(mp4|m3u8)(?:$|\?)/i.test(sourceUrl) };
      const match = source.pathname.match(/\/([^/]+)\/(?:status|statuses)\/(\d+)/i);
      if (!match) return null;
      const path = `/${match[1]}/status/${match[2]}`;
      for (const endpoint of [`https://api.vxtwitter.com${path}`,`https://api.fxtwitter.com${path}`]) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;
          const resolved = mediaFromTweetData(await response.json());
          if (resolved) return resolved;
        } catch {}
      }
      try {
        const serverMedia = await Promise.race([
          tweetMediaService.resolve(sourceUrl),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error("media resolver timeout")),8000))
        ]);
        if (serverMedia?.url) return { ...serverMedia, isVideo: Boolean(serverMedia.isVideo || serverMedia.type === "video") };
      } catch {}
    } catch {}
    return null;
  })();
  tweetMediaCache.set(sourceUrl,request);
  const resolved = await request;
  if (!resolved) tweetMediaCache.delete(sourceUrl);
  return resolved;
}

function unifiedWorldcup(cups) {
  return {
    id: "all",
    title: "🦊 혚쾌 월드컵 🐰",
    icon: "❣️",
    items: cups.flatMap((cup) => cup.items.map((item) => ({ ...item, originalCupId: cup.id })))
  };
}

function CandidateMedia({ item, className = "", controls = false, fit = "cover" }) {
  const [media, setMedia] = useState(item.mediaUrl ? {url:item.mediaUrl,isVideo:Boolean(item.isVideo||/\.(mp4|m3u8)(?:$|\?)/i.test(item.mediaUrl))} : null);
  const [failed, setFailed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const resolveSequence = useRef(0);
  useEffect(() => {
    let active = true;
    const sequence = ++resolveSequence.current;
    setMedia(item.mediaUrl ? {url:item.mediaUrl,isVideo:Boolean(item.isVideo||/\.(mp4|m3u8)(?:$|\?)/i.test(item.mediaUrl))} : null);
    setFailed(false); setResolving(false); setRefreshAttempted(false);
    if (!item.mediaUrl && item.sourceUrl) {
      setResolving(true);
      resolveTweetMedia(item.sourceUrl).then((resolved)=>{
        if (!active || sequence !== resolveSequence.current) return;
        if (resolved) setMedia(resolved); else setFailed(true);
      }).finally(()=>{if(active&&sequence===resolveSequence.current)setResolving(false);});
    }
    return () => { active = false; resolveSequence.current += 1; };
  }, [item.id, item.mediaUrl, item.sourceUrl]);
  const refreshMedia = () => {
    if (!item.sourceUrl || resolving || refreshAttempted) { setFailed(true); return; }
    const sequence = ++resolveSequence.current;
    setRefreshAttempted(true); setResolving(true); setFailed(false);
    tweetMediaCache.delete(item.sourceUrl);
    resolveTweetMedia(item.sourceUrl).then((resolved)=>{
      if (sequence !== resolveSequence.current) return;
      if (resolved) setMedia(resolved); else setFailed(true);
    }).finally(()=>{if(sequence===resolveSequence.current)setResolving(false);});
  };
  const mediaClass = fit === "contain" ? "max-h-[72dvh] h-auto w-full object-contain" : "h-full w-full object-cover";
  if (resolving) return <div className={cn("flex h-full w-full items-center justify-center bg-neutral-950 p-4 text-center text-xs font-black text-neutral-500",className)}>미디어 불러오는 중…</div>;
  if (!media || failed) return <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 p-4 text-center text-sm font-black leading-5 text-neutral-300",className)}>{item.name}</div>;
  if (media.isVideo) return <video src={media.url} autoPlay={!controls} controls={controls} loop muted={!controls} playsInline onError={refreshMedia} className={cn(mediaClass,className)}/>;
  return <img src={media.url} alt="" onError={refreshMedia} className={cn(mediaClass,className)}/>;
}

function WorldcupView() {
  const [cups, setCups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [rankingCup, setRankingCup] = useState(null);
  const [bracketCup, setBracketCup] = useState(null);
  const [game, setGame] = useState(null);
  const [winner, setWinner] = useState(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    let active = true;
    worldcupService.list().then((items) => { if (active) setCups(items); }).catch((reason) => { if (active) setError(reason.message || "월드컵 데이터를 불러오지 못했어요."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const unified = useMemo(() => unifiedWorldcup(cups), [cups]);

  useEffect(() => {
    if (loading || deepLinkHandled) return;
    const params = new URLSearchParams(window.location.search);
    const cupId = params.get("cupId"); const winnerId = params.get("winnerId");
    if (cupId && winnerId) {
      const cup = cupId === "all" ? unified : cups.find((item) => String(item.id) === cupId);
      const found = cup?.items.find((item) => String(item.id) === winnerId);
      if (cup && found) { setSelected(cup); setWinner(found); }
      window.history.replaceState({}, "", window.location.pathname);
    }
    setDeepLinkHandled(true);
  }, [cups, unified, loading, deepLinkHandled]);

  const start = (cup, size) => {
    const roundItems = shuffle(cup.items).slice(0, size);
    setSelected(cup); setWinner(null); setBracketCup(null);
    setGame({ roundItems, nextRound: [], matchIndex: 0 });
  };

  const recordWinner = async (picked) => {
    const originId = picked.originalCupId || selected.id;
    const originCup = cups.find((cup) => String(cup.id) === String(originId));
    const updatedCup = originCup ? { ...originCup, items: originCup.items.map((item) => String(item.id) === String(picked.id) ? { ...item, winCount: Number(item.winCount || 0) + 1 } : item) } : null;
    if (updatedCup) setCups((current) => current.map((cup) => String(cup.id) === String(originId) ? updatedCup : cup));
    setWinner({ ...picked, winCount: Number(picked.winCount || 0) + 1 }); setGame(null);
    worldcupService.incrementWin(picked.supabaseId || picked.id).catch(() => {});
  };

  const choose = (picked) => {
    const advanced = [...game.nextRound, picked];
    const nextIndex = game.matchIndex + 2;
    if (nextIndex >= game.roundItems.length) {
      if (advanced.length === 1) recordWinner(advanced[0]);
      else setGame({ roundItems: shuffle(advanced), nextRound: [], matchIndex: 0 });
    } else setGame({ ...game, nextRound: advanced, matchIndex: nextIndex });
  };

  if (winner) return <WinnerView winner={winner} cup={selected} onBack={()=>{setWinner(null);setSelected(null);}} onAgain={()=>{setWinner(null);setBracketCup(selected);}}/>;
  if (game) {
    const candidates = game.roundItems.slice(game.matchIndex, game.matchIndex + 2);
    return <GameView cup={selected} candidates={candidates} total={game.roundItems.length} matchIndex={game.matchIndex} onChoose={choose} onClose={()=>{setGame(null);setSelected(null);}}/>;
  }

  return <div className="px-4 pb-6 pt-4"><h2 className="text-xl font-black">혚쾌 월드컵</h2>
    {loading ? <div className="mt-5"><ListSkeleton/></div> : error ? <div className="mt-5"><LoadError message={error}/></div> : <div className="mt-4 space-y-3">{[...(unified.items.length>=4?[unified]:[]),...cups].map((cup)=><article key={cup.id} className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900"><button onClick={()=>setSelected(cup)} className="flex w-full items-center gap-4 p-4 text-left"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-3xl">{cup.icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black">{cup.title}</strong><span className="mt-1 block text-[11px] font-bold text-neutral-500">후보 {cup.items.length}개</span></span><Play size={17} className="text-accent" fill="#e50000"/></button><button onClick={()=>setRankingCup(cup)} className="w-full border-t border-white/10 py-3 text-[11px] font-black text-neutral-500"><Crown size={13} className="mr-1.5 inline text-accent"/>랭킹 보기</button></article>)}</div>}
    {selected&&<WorldcupSheet cup={selected} onClose={()=>setSelected(null)} onStart={()=>setBracketCup(selected)} onRanking={()=>setRankingCup(selected)}/>}
    {bracketCup&&<BracketSheet cup={bracketCup} onClose={()=>setBracketCup(null)} onStart={start}/>}
    {rankingCup&&<RankingSheet cup={rankingCup} onClose={()=>setRankingCup(null)}/>}
  </div>;
}

function WorldcupSheet({cup,onClose,onStart,onRanking}) {
  return <AppOverlay className="z-[50]"><div className="h-full bg-black/80 backdrop-blur-sm" onClick={onClose}><div className="mx-auto flex h-full w-full max-w-md items-end p-3"><div onClick={(event)=>event.stopPropagation()} className="w-full animate-pop-in rounded-[28px] border border-white/10 bg-neutral-900 p-5 shadow-2xl"><div className="mx-auto h-1 w-10 rounded bg-neutral-700"/><div className="mt-5 flex aspect-[16/7] items-center justify-center rounded-2xl bg-[radial-gradient(circle,#e5000038,transparent_65%)] text-6xl">{cup.icon}</div><h3 className="mt-4 text-xl font-black">{cup.title}</h3><p className="mt-2 text-xs font-bold text-neutral-500">후보 {cup.items.length}개</p><button disabled={cup.items.length<2} onClick={onStart} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-black disabled:bg-neutral-800 disabled:text-neutral-600"><Play size={16} fill="white"/>시작하기</button><button onClick={onRanking} className="mt-2 w-full rounded-2xl bg-white/5 py-4 text-sm font-bold text-neutral-400">이 월드컵 결과 보기</button></div></div></div></AppOverlay>;
}

function BracketSheet({cup,onClose,onStart}) {
  const sizes = [128,64,32,16,8,4].filter((size)=>size<cup.items.length);
  return <AppOverlay className="z-[60]"><div className="h-full bg-black/85 backdrop-blur-sm" onClick={onClose}><div className="mx-auto flex h-full w-full max-w-md items-end p-3"><div onClick={(event)=>event.stopPropagation()} className="w-full animate-pop-in rounded-[28px] border border-white/10 bg-neutral-900 p-5 shadow-2xl"><h3 className="text-lg font-black">진행할 대진을 선택하세요</h3><p className="mt-1 text-xs text-neutral-500">후보를 무작위로 섞어 시작합니다.</p><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>onStart(cup,cup.items.length)} className="col-span-2 rounded-2xl bg-accent py-4 text-sm font-black">전체 ({cup.items.length}강)</button>{sizes.map((size)=><button key={size} onClick={()=>onStart(cup,size)} className="rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-black">{size}강</button>)}</div><button onClick={onClose} className="mt-3 w-full py-3 text-xs font-bold text-neutral-500">취소</button></div></div></div></AppOverlay>;
}

function RankingSheet({cup,onClose}) {
  const [preview,setPreview]=useState(null);
  const ranking=[...cup.items].sort((a,b)=>Number(b.winCount||0)-Number(a.winCount||0));
  return <><AppOverlay className="z-[60]"><div className="h-full bg-black/85 backdrop-blur-sm" onClick={onClose}><div className="mx-auto flex h-full w-full max-w-md items-end p-3"><div onClick={(event)=>event.stopPropagation()} className="flex max-h-[88dvh] w-full flex-col rounded-[28px] border border-white/10 bg-neutral-900 p-5 shadow-2xl animate-pop-in"><div className="flex shrink-0 items-start"><div><p className="text-[10px] font-black tracking-[.18em] text-accent">LOCAL RANKING</p><h3 className="mt-1 text-lg font-black">{cup.title}</h3><p className="mt-2 text-[10px] text-neutral-600">목록을 누르면 떡밥 미디어를 확인할 수 있어요.</p></div><button onClick={onClose} className="ml-auto rounded-full bg-white/5 p-2"><X size={16}/></button></div><div className="mt-5 min-h-0 space-y-2 overflow-y-auto no-scrollbar">{ranking.map((item,index)=><button key={itemKey(item)} onClick={()=>setPreview(item)} className="flex w-full items-center gap-3 rounded-2xl bg-black/40 p-3 text-left active:bg-white/10"><span className={cn("w-6 text-center text-sm font-black",index<3?"text-accent":"text-neutral-600")}>{index+1}</span><p className="min-w-0 flex-1 truncate text-xs font-bold">{item.name}</p><span className="text-[10px] font-black text-neutral-500">{Number(item.winCount||0)}승</span></button>)}</div></div></div></div></AppOverlay>{preview&&<MediaPreviewModal item={preview} onClose={()=>setPreview(null)}/>}</>;
}

function MediaPreviewModal({item,onClose}) {
  return <AppOverlay className="z-[80]"><div className="flex h-full items-center justify-center bg-black/90 p-4 backdrop-blur-md" onClick={onClose}><div onClick={(event)=>event.stopPropagation()} className="w-full max-w-md animate-pop-in rounded-[28px] border border-white/10 bg-neutral-900 p-4 shadow-2xl"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="text-balance text-sm font-black leading-5">{item.name}</h3>{item.date&&<time className="mt-1 block text-[10px] font-bold text-neutral-600">{item.date}</time>}</div><button onClick={onClose} aria-label="미디어 닫기" className="rounded-full bg-white/5 p-2 text-neutral-500"><X size={16}/></button></div><div className="mt-4 flex max-h-[72dvh] min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-black"><CandidateMedia item={item} controls fit="contain" className="!text-base"/></div>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block w-full rounded-xl bg-white/5 py-3 text-center text-xs font-black text-neutral-400">원본 링크 열기</a>}</div></div></AppOverlay>;
}

function GameView({cup,candidates,total,matchIndex,onChoose,onClose}) {
  const [preview,setPreview]=useState(null);
  const roundTitle=total===2?"결승전":`${total}강`;
  if(candidates.length===1) return <AppOverlay><div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col items-center justify-center bg-black p-6 text-center"><Flame size={32} className="text-accent"/><h2 className="mt-4 text-xl font-black">부전승 발생!</h2><p className="mt-2 text-sm leading-6 text-neutral-500"><b className="text-white">{candidates[0].name}</b>이(가)<br/>다음 라운드로 진출합니다.</p><button onClick={()=>onChoose(candidates[0])} className="mt-7 w-full rounded-2xl bg-accent py-4 text-sm font-black">다음 라운드 이동</button></div></AppOverlay>;
  return <><AppOverlay><div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-black"><header className="flex h-14 shrink-0 items-center border-b border-white/5 px-4"><button onClick={onClose} className="rounded-full p-2 text-neutral-400"><ChevronLeft size={21}/></button><h2 className="mx-auto min-w-0 truncate pr-10 text-sm font-black">{cup?.title}</h2></header><div className="shrink-0 py-4 text-center"><p className="text-xs font-black tracking-widest text-neutral-500">{roundTitle} {Math.floor(matchIndex/2)+1}/{Math.ceil(total/2)}</p></div><div className="relative mx-4 grid h-[46dvh] min-h-[280px] grid-cols-2 gap-2">{candidates.map((candidate)=><button key={itemKey(candidate)} onClick={()=>setPreview(candidate)} aria-label={`${candidate.name} 미디어 전체 보기`} className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900"><CandidateMedia item={candidate} className="!text-base"/></button>)}<div className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-black bg-white text-xs font-black italic text-black shadow-2xl">VS</div></div><div className="flex flex-1 flex-col justify-start gap-3 p-4 pt-6">{candidates.map((candidate)=><button key={itemKey(candidate)} onClick={()=>onChoose(candidate)} className="flex min-h-16 w-full items-center rounded-2xl border border-white/10 bg-neutral-900 px-5 py-4 text-left text-sm font-black leading-5 active:border-accent active:bg-accent"><span className="text-balance">{candidate.name}</span>{candidate.date&&<time className="ml-auto shrink-0 pl-3 text-[10px] font-bold text-neutral-500">{candidate.date}</time>}</button>)}</div></div></AppOverlay>{preview&&<MediaPreviewModal item={preview} onClose={()=>setPreview(null)}/>}</>;
}

function WinnerView({winner,cup,onBack,onAgain}) {
  const [preview,setPreview]=useState(null);
  const shareUrl=()=>{const url=new URL(window.location.origin+window.location.pathname);url.searchParams.set("cupId",cup.id);url.searchParams.set("winnerId",winner.id);return url.toString();};
  const share=async()=>{const data={title:`${cup.title} 결과`,text:`🏆 나의 ${cup.title} 우승 떡밥은 [ ${winner.name} ].ᐟ`,url:shareUrl()};if(navigator.share) await navigator.share(data).catch(()=>{});else{await navigator.clipboard.writeText(data.url);alert("우승 결과 링크가 복사되었습니다!");}};
  return <><AppOverlay><div className="relative mx-auto h-[100dvh] w-full max-w-md overflow-y-auto bg-black px-5 pt-8 text-center no-scrollbar"><div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,#e5000044,transparent_70%)]"/><Medal size={34} className="relative mx-auto text-accent"/><p className="relative mt-3 text-xs font-black tracking-[.25em] text-accent">THE WINNER IS</p><h2 className="relative mt-2 text-3xl font-black">최종 우승</h2><button onClick={()=>setPreview(winner)} aria-label={`${winner.name} 미디어 전체 보기`} className="relative mx-auto mt-6 aspect-square w-[72%] rotate-1 overflow-hidden rounded-[32px] border-2 border-accent shadow-[0_0_60px_#e5000044]"><CandidateMedia item={winner}/><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"/><p className="pointer-events-none absolute inset-x-5 bottom-5 text-lg font-black">{winner.name}</p></button><button onClick={share} className="relative mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-black"><Share2 size={17}/>공유하기</button><button onClick={onAgain} className="relative mt-2 w-full rounded-2xl bg-white/5 py-3 text-sm font-bold text-neutral-400">다시 하기</button><button onClick={onBack} className="relative w-full py-3 text-sm font-bold text-neutral-600">월드컵으로 돌아가기</button></div></AppOverlay>{preview&&<MediaPreviewModal item={winner} onClose={()=>setPreview(null)}/>}</>;
}

function PostypeView({ adminRequest = null }) {
  const frameRef = useRef(null);
  useEffect(() => {
    if (!adminRequest) return;
    const openAdmin = () => frameRef.current?.contentWindow?.postMessage({ type: "hq-open-postype-admin", credential: adminRequest.credential || "" }, window.location.origin);
    const frame = frameRef.current;
    const timer = window.setTimeout(openAdmin, 0);
    frame?.addEventListener("load", openAdmin);
    return () => { window.clearTimeout(timer); frame?.removeEventListener("load", openAdmin); };
  }, [adminRequest?.id, adminRequest?.credential]);
  return <iframe ref={frameRef} src="postype/index.html?v=20260622-3" title="혚쾌 포타 검색기" allow="clipboard-read; clipboard-write" className="h-full w-full border-0 bg-black" />;
}

function AdminHub({ onClose, onOpenPostype }) {
  const [authenticated, setAuthenticated] = useState(() => adminService.hasSession());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState("hub");
  const sectionTitle = { hub: "관리자 모드", archive: "아카이브 관리", worldcup: "월드컵 관리", recommended: "추천 영상 관리" }[section] || "관리자 모드";
  const authenticate = async (event) => {
    event.preventDefault();
    try {
      await adminService.login(password);
      setAuthenticated(true);
      setError("");
    } catch (reason) {
      setError(reason.message || "비밀번호가 맞지 않습니다.");
    }
  };

  return <div className="absolute inset-0 z-[80] flex items-end bg-black/80 p-3 backdrop-blur-md" onClick={onClose}>
    <div onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full overflow-y-auto rounded-[28px] border border-white/10 bg-neutral-950 p-5 shadow-2xl no-scrollbar animate-pop-in">
      <div className="flex items-center"><div><p className="text-[10px] font-black tracking-[.18em] text-accent">ADMIN CENTER</p><h2 className="mt-1 text-xl font-black">{sectionTitle}</h2></div><button onClick={onClose} aria-label="관리자 닫기" className="ml-auto rounded-full bg-white/5 p-2 text-neutral-500"><X size={18}/></button></div>
      {!authenticated ? <form onSubmit={authenticate} className="py-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent"><LockKeyhole size={24}/></div>
        <p className="mt-4 text-center text-sm font-bold">관리자 비밀번호를 입력하세요.</p>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={cn("mt-5 w-full rounded-2xl border bg-black p-4 text-center text-sm outline-none", error ? "border-accent" : "border-white/10")} placeholder="Password" />
        {error && <p className="mt-2 text-center text-xs font-bold text-accent">{error}</p>}
        <button className="mt-3 w-full rounded-2xl bg-accent py-4 text-sm font-black">접속하기</button>
      </form> : section === "hub" ? <div className="grid gap-3 py-6">
        <AdminPortalCard icon={Archive} label="아카이브" description="Supabase 기록 추가·수정·삭제" active onClick={() => setSection("archive")}/>
        <AdminPortalCard icon={Trophy} label="월드컵" description="대회·후보·랭킹 데이터 관리" active onClick={() => setSection("worldcup")}/>
        <AdminPortalCard icon={Video} label="추천 영상 관리" description="수집된 추천 영상과 노출 상태 확인" active onClick={() => setSection("recommended")}/>
        <AdminPortalCard icon={Search} label="포타 검색기" description="작품과 태그 데이터 관리" active onClick={() => onOpenPostype(password)} />
      </div> : section === "worldcup" ? <WorldcupAdmin onBack={() => setSection("hub")}/> : section === "recommended" ? <RecommendedVideosAdmin onBack={() => setSection("hub")}/> : <ArchiveAdmin onBack={() => setSection("hub")}/>}
    </div>
  </div>;
}

function normalizeRecommendedDateQuery(value) {
  const query = String(value || "").trim();
  let match = query.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = query.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = query.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = query.match(/^(\d{4})[-./](\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}`;
  return "";
}

function RecommendedView() {
  const [items, setItems] = useState([]);
  const [videoCategories, setVideoCategories] = useState(DEFAULT_RECOMMENDED_VIDEO_CATEGORIES);
  const [featuredItems, setFeaturedItems] = useState([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pickTouchStartX = useRef(null);

  useEffect(() => {
    let active = true;
    recommendedVideoService.publicList()
      .then((rows) => { if (active) setItems(rows); })
      .catch((reason) => { if (active) setError(reason.message || "추천 영상을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    recommendedVideoService.categories()
      .then((rows) => { if (active) setVideoCategories(rows.map((item) => item.name)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (category !== "전체" && !videoCategories.includes(category)) setCategory("전체");
  }, [category, videoCategories]);

  useEffect(() => {
    let active = true;
    recommendedVideoService.featuredList()
      .then((rows) => { if (active) { setFeaturedItems(rows.slice(0, 10)); setFeaturedIndex(0); } })
      .catch(() => { if (active) setFeaturedItems([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (featuredItems.length < 3) return undefined;
    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % featuredItems.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [featuredItems.length]);

  const searchedItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    const dateNeedle = normalizeRecommendedDateQuery(query);
    return items.filter((item) => {
      const publishedDate = String(item.publishedAt || "").slice(0, 10);
      const matchesSearch = !needle
        || item.title.toLocaleLowerCase("ko-KR").includes(needle)
        || Boolean(dateNeedle && publishedDate.startsWith(dateNeedle));
      return matchesSearch;
    });
  }, [items, query]);

  const categorySections = useMemo(() => {
    const categories = category === "전체" ? videoCategories : [category];
    const sections = categories.map((value) => ({
      key: value,
      title: `${value} 모아보기`,
      items: searchedItems.filter((item) => item.categories.includes(value))
    })).filter((section) => section.items.length);
    if (category === "전체") {
      const uncategorized = searchedItems.filter((item) => !item.categories.some((value) => videoCategories.includes(value)));
      if (uncategorized.length) sections.push({ key: "미분류", title: "기타 영상 모아보기", items: uncategorized });
    }
    return sections;
  }, [searchedItems, category, videoCategories]);

  const displayDate = (value) => {
    const date = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replace(/-/g, ".") : "날짜 없음";
  };
  const moveFeatured = (direction) => {
    if (featuredItems.length < 3) return;
    setFeaturedIndex((current) => (current + direction + featuredItems.length) % featuredItems.length);
  };
  const finishFeaturedSwipe = (event) => {
    if (pickTouchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - pickTouchStartX.current;
    pickTouchStartX.current = null;
    if (Math.abs(distance) < 40) return;
    moveFeatured(distance < 0 ? 1 : -1);
  };
  const showFeatured = featuredItems.length >= 3;
  const featuredItem = showFeatured ? featuredItems[featuredIndex % featuredItems.length] : null;

  return <div className="px-4 pb-6 pt-4">
    <h2 className="text-xl font-black">추천 영상</h2>
    <div className="mt-4"><SearchBar value={query} onChange={setQuery} placeholder="제목 또는 날짜로 검색"/></div>
    <div className="-mx-4 mt-3 overflow-x-auto px-4 no-scrollbar"><div className="flex w-max gap-2">{["전체", ...videoCategories].map((value) => <button key={value} onClick={() => setCategory(value)} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-black transition", category === value ? "border-accent bg-accent text-white" : "border-white/10 bg-white/5 text-neutral-500")}>{value}</button>)}</div></div>
    {featuredItem && <section className="mt-5"><div className="mb-2 flex items-center"><div><p className="text-[10px] font-black tracking-[.18em] text-accent">TODAY&apos;S PICK</p><h3 className="mt-1 text-sm font-black">오늘의 PICK</h3></div><span className="ml-auto text-[10px] font-black text-neutral-600">{featuredIndex + 1} / {featuredItems.length}</span></div>
      <article key={featuredItem.id} onTouchStart={(event) => { pickTouchStartX.current = event.touches[0].clientX; }} onTouchEnd={finishFeaturedSwipe} onTouchCancel={() => { pickTouchStartX.current = null; }} className="touch-pan-y select-none overflow-hidden rounded-3xl border border-accent/25 bg-neutral-900 shadow-[0_16px_50px_#e5000014] animate-fade-in">
        <a href={featuredItem.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block aspect-video overflow-hidden bg-black">{featuredItem.thumbnailUrl ? <img src={featuredItem.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-neutral-700"><Video size={28}/></div>}</a>
        <div className="p-4"><a href={featuredItem.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-black leading-5 active:text-accent">{featuredItem.title || "제목 없음"}</a><p className="mt-2 text-[9px] font-bold text-neutral-600">{displayDate(featuredItem.publishedAt)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{featuredItem.categories.length ? featuredItem.categories.map((value) => <span key={value} className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-bold text-neutral-400">{value}</span>) : <span className="text-[9px] font-bold text-neutral-700">미분류</span>}</div>
          {featuredItem.adminComment && <p className="mt-3 whitespace-pre-wrap rounded-xl border border-white/5 bg-black/30 px-3 py-2.5 text-[10px] leading-4 text-neutral-400">{featuredItem.adminComment}</p>}
        </div>
      </article>
      <div className="mt-3 flex justify-center gap-1.5">{featuredItems.map((item, index) => <button key={item.id} onClick={() => setFeaturedIndex(index)} aria-label={`오늘의 PICK ${index + 1}`} className={cn("h-1.5 rounded-full transition-all", index === featuredIndex ? "w-5 bg-accent" : "w-1.5 bg-neutral-700")}/>)}</div>
    </section>}
    {loading ? <div className="mt-5"><ListSkeleton/></div> : error ? <div className="mt-5"><LoadError message={error}/></div> : categorySections.length ? <div className="mt-7 space-y-8">{categorySections.map((section) => <section key={section.key}>
      <div className="mb-3 flex items-center"><div><h3 className="text-base font-black">{section.title}</h3><p className="mt-1 text-[9px] font-bold text-neutral-600">{section.items.length}개의 추천 영상</p></div><ChevronRight size={18} className="ml-auto text-neutral-700"/></div>
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar"><div className="flex w-max snap-x snap-mandatory gap-3 pb-1">{section.items.map((item) => <article key={`${section.key}-${item.id}`} className="w-[68vw] min-w-[210px] max-w-[250px] snap-start overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/70">
        <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block active:bg-white/5">
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-black text-neutral-700">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <Video size={22}/>}</div>
          <div className="p-3"><h4 className="line-clamp-2 min-h-10 text-xs font-black leading-5">{item.title || "제목 없음"}</h4><p className="mt-2 text-[9px] font-bold text-neutral-600">{displayDate(item.publishedAt)}</p></div>
        </a>
        <div className="flex min-h-10 flex-wrap gap-1.5 border-t border-white/5 px-3 py-2">{item.categories.length ? item.categories.map((value) => <span key={value} className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-bold text-neutral-500">{value}</span>) : <span className="text-[9px] font-bold text-neutral-700">미분류</span>}</div>
      </article>)}</div></div>
    </section>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 py-14 text-center text-xs font-bold text-neutral-600">조건에 맞는 추천 영상이 없습니다.</div>}
  </div>;
}

const DEFAULT_RECOMMENDED_VIDEO_CATEGORIES = ["연말결산", "라이브", "레코딩로그", "승협캠프", "그 외 자컨", "웹/예능"];

function RecommendedVideosAdmin({ onBack }) {
  const [items, setItems] = useState([]);
  const [videoCategories, setVideoCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [collectBusy, setCollectBusy] = useState("");
  const [collectNotice, setCollectNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState("");
  const [bulkSortOrder, setBulkSortOrder] = useState("");
  const [bulkFeaturedOrder, setBulkFeaturedOrder] = useState("");
  const [bulkComment, setBulkComment] = useState("");
  const [adminQuery, setAdminQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([recommendedVideoService.list(), recommendedVideoService.categories()])
      .then(([rows, categories]) => { if (active) { setItems(rows); setVideoCategories(categories); } })
      .catch((reason) => { if (active) setError(reason.message || "추천 영상 목록을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const refreshItems = async () => {
    const rows = await recommendedVideoService.list();
    setItems(rows);
    setSelectedIds((current) => new Set([...current].filter((id) => rows.some((item) => item.id === id))));
  };
  const refreshAfterCollection = async () => {
    try { await refreshItems(); }
    catch { setSaveError("수집은 완료됐지만 목록 새로고침에 실패했습니다."); }
  };
  const addYoutubeVideo = async (event) => {
    event.preventDefault();
    const value = youtubeUrl.trim();
    if (!value) { setSaveError("추가할 YouTube 링크를 입력해주세요."); return; }
    setCollectBusy("manual"); setCollectNotice(""); setSaveError("");
    try {
      await recommendedVideoService.addYoutubeUrl(value);
      setYoutubeUrl("");
      setCollectNotice("YouTube 영상을 수집했습니다. 신규 영상은 노출 OFF 상태입니다.");
      await refreshAfterCollection();
    } catch (reason) {
      setSaveError(reason.message || "YouTube 영상을 수집하지 못했습니다.");
    } finally {
      setCollectBusy("");
    }
  };
  const collectChannelVideos = async (customChannelUrl = "") => {
    const value = String(customChannelUrl || "").trim();
    setCollectBusy(value ? "custom-channel" : "channels"); setCollectNotice(""); setSaveError("");
    try {
      const result = await recommendedVideoService.collectChannels(value);
      if (value) setChannelUrl("");
      setCollectNotice(`${value ? "입력한 채널" : "기본 채널"}에서 신규 영상 ${Number(result.totalInserted || 0)}개를 수집했습니다. 기존 영상은 건너뛰며 신규 영상은 노출 OFF 상태입니다.`);
      await refreshAfterCollection();
    } catch (reason) {
      setSaveError(reason.message || "채널 영상을 수집하지 못했습니다.");
    } finally {
      setCollectBusy("");
    }
  };
  const refreshCategories = async () => {
    const categories = await recommendedVideoService.categories();
    setVideoCategories(categories);
    setCategoryDrafts({});
  };
  const collectCustomChannel = async (event) => {
    event.preventDefault();
    const value = channelUrl.trim();
    if (!value) { setSaveError("수집할 YouTube 채널 링크를 입력해주세요."); return; }
    await collectChannelVideos(value);
  };
  const updateCategoryDraft = (id, name) => setCategoryDrafts((current) => ({ ...current, [id]: name }));
  const createCategory = async (event) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) { setSaveError("추가할 카테고리 이름을 입력해주세요."); return; }
    setCategoryBusy("create"); setSaveError(""); setCollectNotice("");
    try {
      await recommendedVideoService.createCategory(name);
      setNewCategoryName("");
      await refreshCategories();
      setCollectNotice(`'${name}' 카테고리를 추가했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "카테고리를 추가하지 못했습니다.");
    } finally {
      setCategoryBusy("");
    }
  };
  const saveCategory = async (categoryItem) => {
    const name = String(categoryDrafts[categoryItem.id] ?? categoryItem.name).trim();
    if (!name) { setSaveError("카테고리 이름을 입력해주세요."); return; }
    setCategoryBusy(categoryItem.id); setSaveError(""); setCollectNotice("");
    try {
      await recommendedVideoService.updateCategory(categoryItem.id, name);
      await Promise.all([refreshCategories(), refreshItems()]);
      setCollectNotice(`카테고리 이름을 '${name}'(으)로 수정했습니다. 기존 영상에도 반영됐습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "카테고리를 수정하지 못했습니다.");
      await refreshCategories().catch(() => {});
    } finally {
      setCategoryBusy("");
    }
  };
  const deleteCategory = async (categoryItem) => {
    if (!window.confirm(`'${categoryItem.name}' 카테고리를 삭제할까요? 기존 영상에서도 이 카테고리가 제거됩니다.`)) return;
    setCategoryBusy(categoryItem.id); setSaveError(""); setCollectNotice("");
    try {
      await recommendedVideoService.removeCategory(categoryItem.id);
      await Promise.all([refreshCategories(), refreshItems()]);
      setCollectNotice(`'${categoryItem.name}' 카테고리를 삭제했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "카테고리를 삭제하지 못했습니다.");
    } finally {
      setCategoryBusy("");
    }
  };

  const updateItem = (id, changes) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setSavedId("");
    setSaveError("");
  };
  const toggleCategory = (item, category) => {
    const categories = item.categories.includes(category)
      ? item.categories.filter((value) => value !== category)
      : [...item.categories, category];
    updateItem(item.id, { categories });
  };
  const settingsFrom = (item) => ({
    isActive: item.isActive,
    isFeatured: item.isFeatured,
    categories: item.categories,
    sortOrder: Number(item.sortOrder),
    featuredOrder: Number(item.featuredOrder),
    adminComment: item.adminComment
  });
  const validOrders = (targetItems) => targetItems.every((item) => Number.isInteger(Number(item.sortOrder)) && Number.isInteger(Number(item.featuredOrder)));
  const saveItem = async (item) => {
    if (!validOrders([item])) {
      setSaveError("추천 목록 순서와 PICK 순서는 정수로 입력해주세요.");
      return;
    }
    setSavingId(item.id); setSavedId(""); setSaveError("");
    try {
      const saved = await recommendedVideoService.update(item.id, settingsFrom(item));
      setItems((current) => current.map((value) => value.id === item.id ? saved : value));
      setSavedId(item.id);
    } catch (reason) {
      setSaveError(reason.message || "추천 영상 설정을 저장하지 못했습니다.");
    } finally {
      setSavingId("");
    }
  };

  const categoryNames = useMemo(() => videoCategories.map((item) => item.name).filter(Boolean), [videoCategories]);
  const filteredAdminItems = useMemo(() => {
    const needle = adminQuery.trim().toLocaleLowerCase("ko-KR");
    if (!needle) return items;
    const compactNeedle = needle.replace(/[^0-9a-z가-힣]/gi, "");
    return items.filter((item) => {
      const searchable = [item.title, item.channelTitle, item.youtubeId, item.publishedAt, item.adminComment, ...item.categories]
        .join(" ").toLocaleLowerCase("ko-KR");
      const compactDate = String(item.publishedAt || "").slice(0, 10).replace(/\D/g, "");
      return searchable.includes(needle) || Boolean(compactNeedle && compactDate.includes(compactNeedle));
    });
  }, [items, adminQuery]);
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const visibleSelectedCount = filteredAdminItems.filter((item) => selectedIds.has(item.id)).length;
  const allVisibleSelected = filteredAdminItems.length > 0 && visibleSelectedCount === filteredAdminItems.length;
  const toggleSelected = (id) => setSelectedIds((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds((current) => {
    const next = new Set(current);
    filteredAdminItems.forEach((item) => allVisibleSelected ? next.delete(item.id) : next.add(item.id));
    return next;
  });
  const applyToSelected = (changes) => {
    if (!selectedIds.size) return;
    setItems((current) => current.map((item) => {
      if (!selectedIds.has(item.id)) return item;
      const next = typeof changes === "function" ? changes(item) : changes;
      return { ...item, ...next };
    }));
    setSavedId(""); setSaveError(""); setCollectNotice("");
  };
  const applyBulkCategory = (category) => {
    const remove = selectedItems.length > 0 && selectedItems.every((item) => item.categories.includes(category));
    applyToSelected((item) => ({
      categories: remove ? item.categories.filter((value) => value !== category) : [...new Set([...item.categories, category])]
    }));
  };
  const applyBulkOrders = () => {
    const sortOrder = bulkSortOrder === "" ? null : Number(bulkSortOrder);
    const featuredOrder = bulkFeaturedOrder === "" ? null : Number(bulkFeaturedOrder);
    if (sortOrder === null && featuredOrder === null) { setSaveError("일괄 적용할 순서를 하나 이상 입력해주세요."); return; }
    if ((sortOrder !== null && !Number.isInteger(sortOrder)) || (featuredOrder !== null && !Number.isInteger(featuredOrder))) { setSaveError("일괄 순서는 정수로 입력해주세요."); return; }
    applyToSelected({ ...(sortOrder === null ? {} : { sortOrder }), ...(featuredOrder === null ? {} : { featuredOrder }) });
  };
  const saveSelected = async () => {
    if (!selectedItems.length) return;
    if (!validOrders(selectedItems)) { setSaveError("추천 목록 순서와 PICK 순서는 정수로 입력해주세요."); return; }
    setBulkBusy("save"); setSaveError(""); setCollectNotice(""); setSavedId("");
    try {
      const saved = await recommendedVideoService.updateMany(selectedItems.map((item) => ({ id: item.id, updates: settingsFrom(item) })));
      const savedById = new Map(saved.map((item) => [item.id, item]));
      setItems((current) => current.map((item) => savedById.get(item.id) || item));
      setCollectNotice(`선택한 영상 ${saved.length}개의 설정을 저장했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "선택한 영상 설정을 저장하지 못했습니다.");
    } finally {
      setBulkBusy("");
    }
  };
  const deleteSelected = async () => {
    if (!selectedItems.length || !window.confirm(`선택한 추천 영상 ${selectedItems.length}개를 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
    const ids = selectedItems.map((item) => item.id);
    setBulkBusy("delete"); setSaveError(""); setCollectNotice("");
    try {
      const deletedCount = await recommendedVideoService.removeMany(ids);
      setItems((current) => current.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      setCollectNotice(`추천 영상 ${deletedCount}개를 삭제했습니다.`);
    } catch (reason) {
      setSaveError(reason.message || "선택한 추천 영상을 삭제하지 못했습니다.");
    } finally {
      setBulkBusy("");
    }
  };

  const uploadDate = (value) => {
    if (!value) return "업로드일 없음";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const featuredActiveCount = items.filter((item) => item.isActive && item.isFeatured).length;

  return <div className="pt-5">
    <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 선택</button>
    <div className="mt-5 flex items-end"><div><p className="text-[10px] font-black tracking-wider text-neutral-600">RECOMMENDED VIDEOS</p><p className="mt-1 text-xs font-black">등록 영상 <span className="text-accent">{items.length}</span>개</p></div><p className="ml-auto text-[9px] font-bold text-neutral-600">업로드일 최신순</p></div>
    <div className="mt-4"><SearchBar value={adminQuery} onChange={setAdminQuery} placeholder="제목, 채널명, 날짜, 카테고리로 검색"/></div>
    {adminQuery.trim() && <p className="mt-2 text-right text-[9px] font-bold text-neutral-600">검색 결과 {filteredAdminItems.length}개</p>}
    <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-white/[.03] p-3">
      <form onSubmit={addYoutubeVideo} className="flex gap-2"><input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="YouTube 영상 링크" disabled={Boolean(collectBusy)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(collectBusy) || !youtubeUrl.trim()} className="shrink-0 rounded-xl bg-accent px-3 py-3 text-[10px] font-black disabled:opacity-40">{collectBusy === "manual" ? "추가 중…" : "링크 추가"}</button></form>
      <form onSubmit={collectCustomChannel} className="flex gap-2"><input type="url" value={channelUrl} onChange={(event) => setChannelUrl(event.target.value)} placeholder="YouTube 채널 링크" disabled={Boolean(collectBusy)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(collectBusy) || !channelUrl.trim()} className="shrink-0 rounded-xl border border-accent/30 bg-accent/10 px-3 py-3 text-[10px] font-black text-accent disabled:opacity-40">{collectBusy === "custom-channel" ? "수집 중…" : "채널 수집"}</button></form>
      <button type="button" onClick={() => collectChannelVideos()} disabled={Boolean(collectBusy)} className="w-full rounded-xl border border-white/10 bg-black/40 py-3 text-[10px] font-black text-neutral-400 disabled:opacity-40">{collectBusy === "channels" ? "기본 채널 수집 중…" : "기본 4개 채널 신규 영상 수집"}</button>
      <p className="text-[9px] leading-4 text-neutral-600">기존 영상이 확인되면 이전 페이지 탐색을 멈춥니다. 신규 영상은 노출 OFF 상태로 저장되며 직접 노출 설정을 변경해야 합니다.</p>
    </div>
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-3">
      <div><p className="text-xs font-black">추천 영상 카테고리 관리</p><p className="mt-1 text-[9px] font-bold leading-4 text-neutral-600">이름 수정과 삭제는 기존 영상의 카테고리에도 함께 반영됩니다.</p></div>
      <form onSubmit={createCategory} className="mt-3 flex gap-2"><input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="새 카테고리 이름" disabled={Boolean(categoryBusy)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-[10px] outline-none focus:border-accent disabled:opacity-50"/><button disabled={Boolean(categoryBusy) || !newCategoryName.trim()} className="shrink-0 rounded-xl bg-accent px-3 py-3 text-[10px] font-black disabled:opacity-40">{categoryBusy === "create" ? "추가 중…" : "추가"}</button></form>
      <div className="mt-3 space-y-2">{videoCategories.map((categoryItem) => { const draftName = categoryDrafts[categoryItem.id] ?? categoryItem.name; return <div key={categoryItem.id} className="flex gap-2"><input value={draftName} onChange={(event) => updateCategoryDraft(categoryItem.id, event.target.value)} disabled={Boolean(categoryBusy)} aria-label="카테고리 이름" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[10px] font-bold outline-none focus:border-accent disabled:opacity-50"/><button type="button" onClick={() => saveCategory(categoryItem)} disabled={Boolean(categoryBusy) || !String(draftName).trim()} className="rounded-xl border border-accent/30 bg-accent/10 px-3 text-[9px] font-black text-accent disabled:opacity-40">{categoryBusy === categoryItem.id ? "처리 중…" : "저장"}</button><button type="button" onClick={() => deleteCategory(categoryItem)} disabled={Boolean(categoryBusy)} aria-label={`${categoryItem.name} 카테고리 삭제`} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-red-400 disabled:opacity-40"><Trash2 size={14}/></button></div>; })}</div>
    </section>
    {collectNotice && <p className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-[10px] font-bold text-neutral-400">{collectNotice}</p>}
    {!loading && !error && <div className={cn("mt-4 rounded-2xl border p-3", featuredActiveCount < 3 ? "border-accent/30 bg-accent/10" : "border-white/10 bg-white/[.03]")}><div className="flex items-center"><p className="text-[10px] font-black text-neutral-500">노출 중인 오늘의 PICK</p><strong className={cn("ml-auto text-lg font-black", featuredActiveCount < 3 ? "text-accent" : "text-white")}>{featuredActiveCount}개</strong></div>{featuredActiveCount < 3 && <p className="mt-2 text-[10px] font-bold leading-4 text-accent">오늘의 PICK은 최소 3개 이상 선택해야 추천 탭에 노출됩니다.</p>}</div>}
    {!loading && !error && filteredAdminItems.length > 0 && <div className="mt-4 flex items-center rounded-xl border border-white/10 bg-white/[.03] px-3 py-2.5"><label className="flex cursor-pointer items-center gap-2 text-[10px] font-black text-neutral-400"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 accent-accent"/>{adminQuery.trim() ? "검색 결과 전체 선택" : "전체 선택"}</label><span className="ml-auto text-[10px] font-black text-accent">{selectedItems.length}개 선택</span></div>}
    {selectedItems.length > 0 && <section className="mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center"><div><p className="text-xs font-black">선택 항목 일괄 설정</p><p className="mt-1 text-[9px] font-bold text-neutral-500">수정 후 아래 ‘선택 설정 저장’을 눌러 반영하세요.</p></div><button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto rounded-lg border border-white/10 px-2 py-1 text-[9px] font-black text-neutral-500">선택 해제</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => applyToSelected({ isActive: true })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">노출 ON</button><button type="button" onClick={() => applyToSelected({ isActive: false })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black text-neutral-500">노출 OFF</button><button type="button" onClick={() => applyToSelected({ isFeatured: true })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">PICK 지정</button><button type="button" onClick={() => applyToSelected({ isFeatured: false })} className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black text-neutral-500">PICK 해제</button></div>
      <div className="mt-3"><p className="text-[9px] font-black text-neutral-500">카테고리 전체 추가/해제</p><div className="mt-2 flex flex-wrap gap-1.5">{categoryNames.map((value) => { const selected = selectedItems.every((item) => item.categories.includes(value)); return <button type="button" key={value} onClick={() => applyBulkCategory(value)} className={cn("rounded-full border px-2.5 py-1.5 text-[9px] font-bold", selected ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 bg-black/30 text-neutral-500")}>{value}</button>; })}</div></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><label className="rounded-xl bg-black/40 px-3 py-2"><span className="block text-[9px] font-black text-neutral-600">추천 목록 순서</span><input type="number" step="1" value={bulkSortOrder} onChange={(event) => setBulkSortOrder(event.target.value)} placeholder="유지" className="mt-1 w-full bg-transparent text-xs font-black outline-none placeholder:text-neutral-700"/></label><label className="rounded-xl bg-black/40 px-3 py-2"><span className="block text-[9px] font-black text-neutral-600">PICK 순서</span><input type="number" step="1" value={bulkFeaturedOrder} onChange={(event) => setBulkFeaturedOrder(event.target.value)} placeholder="유지" className="mt-1 w-full bg-transparent text-xs font-black outline-none placeholder:text-neutral-700"/></label></div>
      <button type="button" onClick={applyBulkOrders} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">입력한 순서 일괄 적용</button>
      <label className="mt-3 block rounded-xl bg-black/40 px-3 py-2"><span className="block text-[9px] font-black text-neutral-600">운영자 코멘트 일괄 입력</span><textarea rows={2} value={bulkComment} onChange={(event) => setBulkComment(event.target.value)} placeholder="비워서 적용하면 코멘트가 삭제됩니다." className="mt-1 w-full resize-none bg-transparent text-[10px] leading-4 outline-none placeholder:text-neutral-700"/></label>
      <button type="button" onClick={() => applyToSelected({ adminComment: bulkComment })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 py-2.5 text-[10px] font-black">코멘트 일괄 적용</button>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button type="button" disabled={Boolean(bulkBusy)} onClick={saveSelected} className="rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">{bulkBusy === "save" ? "저장 중…" : `선택 설정 저장 (${selectedItems.length})`}</button><button type="button" disabled={Boolean(bulkBusy)} onClick={deleteSelected} aria-label="선택 영상 삭제" className="flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-red-400 disabled:opacity-50">{bulkBusy === "delete" ? <RefreshCw size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></div>
    </section>}
    {saveError && <p className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-[10px] font-bold text-accent">{saveError}</p>}
    {loading ? <div className="mt-4"><ListSkeleton/></div> : error ? <div className="mt-4"><LoadError message={error}/></div> : filteredAdminItems.length ? <div className="mt-4 space-y-3">{filteredAdminItems.map((item) => <article key={item.id} className={cn("overflow-hidden rounded-2xl border bg-white/[.03]", selectedIds.has(item.id) ? "border-accent/50" : "border-white/10")}>
      <div className="flex gap-3 p-3"><label className="flex shrink-0 cursor-pointer items-start pt-1" aria-label={`${item.title || "제목 없음"} 선택`}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="h-4 w-4 accent-accent"/></label>
        <div className="flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black text-neutral-700">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover"/> : <Video size={20}/>}</div>
        <div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-xs font-black leading-5">{item.title || "제목 없음"}</h3><p className="mt-1 truncate text-[10px] font-bold text-neutral-500">{item.channelTitle || "채널명 없음"}</p><p className="mt-1 text-[9px] text-neutral-600">{uploadDate(item.publishedAt)}</p></div>
      </div>
      <div className="border-t border-white/5 px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={item.isActive} onClick={() => updateItem(item.id, { isActive: !item.isActive })} className={cn("rounded-xl border px-3 py-2.5 text-left", item.isActive ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/40")}><span className="block text-[9px] font-black text-neutral-600">노출 여부</span><span className={cn("mt-1 block text-[10px] font-black", item.isActive ? "text-accent" : "text-neutral-400")}>{item.isActive ? "ON" : "OFF"}</span></button>
          <button type="button" aria-pressed={item.isFeatured} onClick={() => updateItem(item.id, { isFeatured: !item.isFeatured })} className={cn("rounded-xl border px-3 py-2.5 text-left", item.isFeatured ? "border-accent/40 bg-accent/10" : "border-white/10 bg-black/40")}><span className="block text-[9px] font-black text-neutral-600">오늘의 PICK</span><span className={cn("mt-1 block text-[10px] font-black", item.isFeatured ? "text-accent" : "text-neutral-400")}>{item.isFeatured ? "지정" : "해제"}</span></button>
        </div>
        <div className="mt-3"><p className="text-[9px] font-black text-neutral-600">카테고리</p><div className="mt-2 flex flex-wrap gap-1.5">{categoryNames.map((category) => { const selected = item.categories.includes(category); return <button type="button" aria-pressed={selected} key={category} onClick={() => toggleCategory(item, category)} className={cn("rounded-full border px-2.5 py-1.5 text-[9px] font-bold", selected ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 bg-white/5 text-neutral-500")}>{category}</button>; })}</div></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">추천 목록 순서</span><input type="number" step="1" value={item.sortOrder} onChange={(event) => updateItem(item.id, { sortOrder: event.target.value })} className="mt-1 w-full bg-transparent text-xs font-black text-neutral-300 outline-none"/></label>
          <label className="rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">PICK 순서</span><input type="number" step="1" value={item.featuredOrder} onChange={(event) => updateItem(item.id, { featuredOrder: event.target.value })} className="mt-1 w-full bg-transparent text-xs font-black text-neutral-300 outline-none"/></label>
        </div>
        <label className="mt-2 block rounded-xl bg-black/40 px-3 py-2.5"><span className="block text-[9px] font-black text-neutral-600">운영자 코멘트</span><textarea rows={3} value={item.adminComment} onChange={(event) => updateItem(item.id, { adminComment: event.target.value })} placeholder="운영자 코멘트 입력" className="mt-1 w-full resize-none bg-transparent text-[10px] leading-4 text-neutral-300 outline-none placeholder:text-neutral-700"/></label>
        <button type="button" disabled={Boolean(savingId) || Boolean(bulkBusy)} onClick={() => saveItem(item)} className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">{savingId === item.id ? "저장 중…" : savedId === item.id ? "저장됨" : "설정 저장"}</button>
      </div>
    </article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 py-12 text-center text-xs font-bold text-neutral-600">{adminQuery.trim() ? "검색 조건에 맞는 추천 영상이 없습니다." : "등록된 추천 영상이 없습니다."}</div>}
  </div>;
}

function AdminPortalCard({ icon: Icon, label, description, active, onClick, badge }) {
  return <button disabled={!active} onClick={onClick} className={cn("flex items-center gap-4 rounded-2xl border p-4 text-left", active ? "border-accent/30 bg-accent/10" : "border-white/10 bg-white/[.03] opacity-60")}>
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", active ? "bg-accent text-white" : "bg-white/5 text-neutral-500")}><Icon size={20}/></span>
    <span><span className="flex items-center gap-2 text-sm font-black">{label}{badge && <em className="not-italic rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-neutral-500">{badge}</em>}</span><span className="mt-1 block text-[11px] text-neutral-500">{description}</span></span>
    {active && <ChevronRight size={17} className="ml-auto text-accent"/>}
  </button>;
}

function WorldcupAdmin({ onBack }) {
  const emptyCandidate = { id: "", name: "", date: "", sourceUrl: "", mediaUrl: "", isVideo: false, winCount: 0 };
  const [cups,setCups]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [editing,setEditing]=useState(null);
  const [selectedIds,setSelectedIds]=useState([]);
  const [candidateForm,setCandidateForm]=useState(null);
  const [bulkOpen,setBulkOpen]=useState(false);
  const [bulkText,setBulkText]=useState("");

  const load=async()=>{setLoading(true);setError("");try{setCups(await worldcupService.list());}catch(reason){setError(reason.message||"월드컵 데이터를 불러오지 못했어요.");}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const updateCupList=(cup)=>setCups((current)=>{const exists=current.some((item)=>String(item.id)===String(cup.id));return (exists?current.map((item)=>String(item.id)===String(cup.id)?cup:item):[...current,cup]).sort((a,b)=>Number(a.id)-Number(b.id));});
  const persist=async(next,message="저장되었습니다.")=>{setBusy(true);setError("");try{const saved=await worldcupService.save(next);setEditing(saved);updateCupList(saved);setNotice(message);return saved;}catch(reason){setError(reason.message||"저장하지 못했어요.");return null;}finally{setBusy(false);}};
  const openCup=(cup)=>{setEditing(JSON.parse(JSON.stringify(cup)));setSelectedIds([]);setCandidateForm(null);setBulkOpen(false);setNotice("");setError("");};
  const createCup=()=>openCup({id:Date.now(),title:"새로운 혚쾌 월드컵",icon:"🏆",items:[]});
  const removeCup=async(cup)=>{if(!window.confirm(`'${cup.title}'을(를) 삭제할까요?`))return;setBusy(true);try{await worldcupService.remove(cup.id);setCups((current)=>current.filter((item)=>String(item.id)!==String(cup.id)));setNotice("월드컵을 삭제했습니다.");}catch(reason){setError(reason.message||"삭제하지 못했어요.");}finally{setBusy(false);}};
  const saveCup=()=>{if(!editing.title.trim())return setError("월드컵 제목을 입력해주세요.");persist(editing,"월드컵을 저장하고 배포했습니다.");};
  const saveCandidate=async(event)=>{event.preventDefault();if(!candidateForm.name.trim())return setError("후보 이름을 입력해주세요.");const existing=editing.items.find((item)=>String(item.id)===String(candidateForm.id));const candidate={id:candidateForm.id||Date.now(),name:candidateForm.name.trim(),date:candidateForm.date||"",sourceUrl:candidateForm.sourceUrl.trim(),mediaUrl:candidateForm.mediaUrl.trim(),isVideo:/\.mp4(?:$|\?)/i.test(candidateForm.mediaUrl),winCount:Number(existing?.winCount||candidateForm.winCount||0)};const next={...editing,items:existing?editing.items.map((item)=>String(item.id)===String(candidate.id)?candidate:item):[...editing.items,candidate]};const saved=await persist(next,existing?"후보를 수정했습니다.":"후보를 추가했습니다.");if(saved)setCandidateForm(null);};
  const removeCandidates=async(ids)=>{if(!ids.length)return;if(!window.confirm(`${ids.length}개 후보를 삭제할까요?`))return;const keys=new Set(ids.map(String));const saved=await persist({...editing,items:editing.items.filter((item)=>!keys.has(String(item.id)))},`${ids.length}개 후보를 삭제했습니다.`);if(saved)setSelectedIds([]);};
  const processBulk=async()=>{const blocks=bulkText.trim().split(/\n\s*\n/).map((block)=>block.split("\n").map((line)=>line.trim()).filter(Boolean)).filter((lines)=>lines.length);if(!blocks.length)return setError("추가할 텍스트를 입력해주세요.");const now=Date.now();const additions=blocks.map((lines,index)=>({id:now+index,name:lines[0],date:"",sourceUrl:lines[1]||"",mediaUrl:"",isVideo:false,winCount:0}));const saved=await persist({...editing,items:[...editing.items,...additions]},`${additions.length}개 후보를 추가했습니다.`);if(saved){setBulkOpen(false);setBulkText("");}};

  if(loading)return <div className="py-12"><ListSkeleton/><p className="mt-4 text-center text-xs font-bold text-neutral-500">기존 월드컵 데이터를 불러오는 중…</p></div>;
  if(!editing)return <div className="pt-5"><button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 선택</button>{error&&<p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs font-bold text-accent">{error}</p>}{notice&&<p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-neutral-400">{notice}</p>}<button onClick={createCup} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-accent/10 py-3.5 text-xs font-black text-accent"><Plus size={16}/>새 월드컵 만들기</button><p className="mb-2 mt-5 text-[10px] font-black tracking-wider text-neutral-600">생성된 월드컵 목록</p><div className="space-y-2">{cups.map((cup)=><div key={cup.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl">{cup.icon}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{cup.title}</p><p className="mt-1 text-[10px] text-neutral-600">후보 {cup.items.length}개</p></div><button onClick={()=>openCup(cup)} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>removeCup(cup)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></div>)}</div></div>;

  const allSelected=editing.items.length>0&&editing.items.every((item)=>selectedIds.includes(String(item.id)));
  return <div className="pt-5"><div className="flex items-center"><button onClick={()=>setEditing(null)} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>월드컵 목록</button><button disabled={busy} onClick={saveCup} className="ml-auto rounded-full bg-accent px-4 py-2 text-[11px] font-black disabled:opacity-50">저장 및 배포</button></div>{error&&<p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs font-bold text-accent">{error}</p>}{notice&&<p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-neutral-400">{notice}</p>}<div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><AdminInput label="월드컵 제목" value={editing.title} onChange={(value)=>setEditing((current)=>({...current,title:value}))}/><div className="mt-2"><AdminInput label="아이콘 (이모지 1개)" value={editing.icon} onChange={(value)=>setEditing((current)=>({...current,icon:value}))}/></div></div><div className="mt-5 flex items-center"><label className="flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={allSelected} onChange={()=>setSelectedIds(allSelected?[]:editing.items.map((item)=>String(item.id)))} className="h-4 w-4 accent-[#e50000]"/>후보 <span className="text-accent">{editing.items.length}</span></label><div className="ml-auto flex gap-1.5"><button disabled={!selectedIds.length||busy} onClick={()=>removeCandidates(selectedIds)} className="rounded-lg bg-accent/10 px-2.5 py-2 text-[10px] font-black text-accent disabled:opacity-40">선택삭제</button><button onClick={()=>{setBulkOpen(true);setBulkText("");}} className="rounded-lg bg-white/5 px-2.5 py-2 text-[10px] font-black text-neutral-400">대량추가</button><button onClick={()=>setCandidateForm(emptyCandidate)} className="rounded-lg bg-accent px-2.5 py-2 text-[10px] font-black">+ 후보추가</button></div></div>
    {candidateForm&&<form onSubmit={saveCandidate} className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4"><div className="flex items-center"><h3 className="text-sm font-black">{candidateForm.id?"후보 수정":"후보 추가"}</h3><button type="button" onClick={()=>setCandidateForm(null)} className="ml-auto"><X size={16}/></button></div><div className="mt-3 space-y-2"><AdminInput label="후보 이름" value={candidateForm.name} onChange={(value)=>setCandidateForm((current)=>({...current,name:value}))} required/><AdminInput label="날짜 (YYYY-MM-DD)" type="date" value={candidateForm.date} onChange={(value)=>setCandidateForm((current)=>({...current,date:value}))}/><AdminInput label="원본 링크 (X/Twitter 등)" type="url" value={candidateForm.sourceUrl} onChange={(value)=>setCandidateForm((current)=>({...current,sourceUrl:value}))}/><AdminInput label="미디어 URL (선택)" type="url" value={candidateForm.mediaUrl} onChange={(value)=>setCandidateForm((current)=>({...current,mediaUrl:value}))}/></div><button disabled={busy} className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">{busy?"저장 중…":"저장"}</button></form>}
    {bulkOpen&&<div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center"><div><h3 className="text-sm font-black">대량 항목 추가</h3><p className="mt-1 text-[10px] leading-4 text-neutral-500">후보 이름 다음 줄에 링크를 넣고, 후보 사이는 빈 줄로 구분하세요.<br/>텍스트 후보는 링크를 생략할 수 있습니다.</p></div><button onClick={()=>setBulkOpen(false)} className="ml-auto"><X size={16}/></button></div><textarea rows={8} value={bulkText} onChange={(event)=>setBulkText(event.target.value)} placeholder={`후보 이름\nhttps://x.com/...\n\n텍스트 후보 이름`} className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black p-3 text-xs leading-5 outline-none focus:border-accent"/><button disabled={busy} onClick={processBulk} className="mt-2 w-full rounded-xl bg-accent py-3 text-xs font-black disabled:opacity-50">일괄 추가</button></div>}
    <div className="mt-4 space-y-2">{editing.items.length?editing.items.map((item)=><div key={item.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-2.5"><input type="checkbox" checked={selectedIds.includes(String(item.id))} onChange={()=>setSelectedIds((current)=>current.includes(String(item.id))?current.filter((id)=>id!==String(item.id)):[...current,String(item.id)])} className="h-4 w-4 shrink-0 accent-[#e50000]"/><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 text-xs font-black text-neutral-500">{item.mediaUrl?<img src={item.mediaUrl} alt="" className="h-full w-full object-cover"/>:"T"}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{item.name}</p><p className="mt-1 truncate text-[9px] text-neutral-600">{item.date||item.sourceUrl||"텍스트 항목"} · {Number(item.winCount||0)}승</p></div><button onClick={()=>setCandidateForm({...item})} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={13}/></button><button disabled={busy} onClick={()=>removeCandidates([item.id])} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={13}/></button></div>):<p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-xs text-neutral-600">등록된 후보가 없습니다.</p>}</div>
  </div>;
}

function ArchiveAdmin({ onBack }) {
  const adminToday = getKstDate();
  const [adminTodayYear, adminTodayMonth] = adminToday.split("-").map(Number);
  const blank = { title: "", date: adminToday, link: "", account: "", mainCategory: "무대영상", subCategory: "음악방송", rawKeywords: "", thumbnailUrl: "" };
  const [adminTab, setAdminTab] = useState("list");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const listRequestRef = useRef(0);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [mainFilter, setMainFilter] = useState("전체");
  const [subFilter, setSubFilter] = useState("전체");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMain, setSelectedMain] = useState([]);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkSub, setBulkSub] = useState("");
  const [adminYear, setAdminYear] = useState(adminTodayYear);
  const [adminMonth, setAdminMonth] = useState(adminTodayMonth);
  const [adminDate, setAdminDate] = useState(adminToday);
  const [calendarMonthItems, setCalendarMonthItems] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const calendarRequestRef = useRef(0);
  const [rawItems, setRawItems] = useState([]);
  const [rawLoaded, setRawLoaded] = useState(false);
  const [selectedRaw, setSelectedRaw] = useState([]);
  const [rawAccount, setRawAccount] = useState("");
  const [rawFrom, setRawFrom] = useState("");
  const [rawTo, setRawTo] = useState("");
  const [rawBulkDate, setRawBulkDate] = useState("");
  const [rawBulkSub, setRawBulkSub] = useState("");
  const [twitterId, setTwitterId] = useState("");
  const [twitterFrom, setTwitterFrom] = useState("");
  const [twitterTo, setTwitterTo] = useState("");
  const calendarMonthKey = `${adminYear}-${pad(adminMonth)}`;
  const calendarItems = calendarMonthItems.filter((item) => item.date === adminDate);
  const rawFiltered = rawItems.filter((item) => (!rawAccount || item.account.toLowerCase().includes(rawAccount.toLowerCase())) && (!rawFrom || item.date >= rawFrom) && (!rawTo || item.date <= rawTo));
  const selectedMainItems = items.filter((item) => selectedMain.includes(item.id));
  const selectedRawItems = rawItems.filter((item) => selectedRaw.includes(item.id));
  const adminYears = Array.from({ length: 12 }, (_, index) => 2017 + index);
  const loadList = async (nextPage = page) => {
    const requestId = ++listRequestRef.current;
    setLoading(true); setLoadError("");
    try {
      const result = await archiveService.adminPage({ page: nextPage, limit: 100, query, mainCategory: mainFilter, subCategory: subFilter, dateFrom, dateTo, status: "published" });
      if (requestId !== listRequestRef.current) return;
      setItems(result.items || []); setTotal(result.total || 0); setPage(nextPage); setSelectedMain([]);
    } catch (error) { if (requestId === listRequestRef.current) setLoadError(error.message || "관리자 기록을 불러오지 못했습니다."); }
    finally { if (requestId === listRequestRef.current) setLoading(false); }
  };
  const loadCalendar = async () => {
    const requestId = ++calendarRequestRef.current;
    const start = `${adminYear}-${pad(adminMonth)}-01`;
    const end = `${adminYear}-${pad(adminMonth)}-${pad(new Date(adminYear, adminMonth, 0).getDate())}`;
    setCalendarLoading(true); setCalendarError("");
    try {
      const result = await archiveService.adminAll({ dateFrom: start, dateTo: end, status: "published" });
      if (requestId !== calendarRequestRef.current) return;
      setCalendarMonthItems(result.items || []);
    } catch (error) { if (requestId === calendarRequestRef.current) { setCalendarError(error.message || "관리자 캘린더를 불러오지 못했습니다."); setCalendarMonthItems([]); } }
    finally { if (requestId === calendarRequestRef.current) setCalendarLoading(false); }
  };
  useEffect(() => {
    if (adminTab !== "list") return undefined;
    const timer = window.setTimeout(() => loadList(1), 250);
    return () => window.clearTimeout(timer);
  }, [adminTab, query, mainFilter, subFilter, dateFrom, dateTo]);
  useEffect(() => { if (adminTab === "calendar") loadCalendar(); }, [adminTab, adminYear, adminMonth]);
  const reloadCurrent = async () => { if (adminTab === "calendar") await loadCalendar(); else await loadList(page); };
  const openForm = (item = null, date = null) => { setEditing(item); setForm(item ? { ...item, rawKeywords: item.rawKeywords || item.keywords?.join(", ") || "" } : { ...blank, date: date || blank.date }); setFormOpen(true); };
  const update = (key, value) => setForm((current) => key === "subCategory" ? { ...current, subCategory: value, mainCategory: mainCategoryFor(value) } : { ...current, [key]: value });
  const save = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const wasRaw = editing?._raw;
      if (wasRaw) await archiveService.updateRaw(editing.id, form);
      else if (editing) await archiveService.update(editing.id, form);
      else await archiveService.create(form);
      if (wasRaw) await loadRaw(); else await reloadCurrent();
      setEditing(null); setForm(blank); setFormOpen(false); alert(editing ? "수정했습니다." : "추가했습니다.");
    } catch (error) { alert(error.message); } finally { setBusy(false); }
  };
  const remove = async (item) => {
    if (!confirm(`「${item.title}」 기록을 삭제할까요?`)) return;
    setBusy(true); try { await archiveService.remove(item.id); await reloadCurrent(); } catch (error) { alert(error.message); } finally { setBusy(false); }
  };
  const loadRaw = async () => { setBusy(true); try { setRawItems(await archiveService.rawList()); setRawLoaded(true); setSelectedRaw([]); } catch (error) { alert(error.message); } finally { setBusy(false); } };
  const runMany = async (targets, action) => { let success = 0; let failed = 0; for (const item of targets) { try { await action(item); success++; } catch { failed++; } } return { success, failed }; };
  const applyBulk = async (source) => {
    const isRaw = source === "raw"; const targets = isRaw ? selectedRawItems : selectedMainItems; const nextDate = isRaw ? rawBulkDate : bulkDate; const nextSub = isRaw ? rawBulkSub : bulkSub;
    if (!targets.length) return alert("선택된 항목이 없습니다.");
    if (!nextDate && !nextSub) return alert("변경할 날짜 또는 소분류를 선택해주세요.");
    if (!confirm(`선택한 ${targets.length}개 항목을 일괄 수정할까요?`)) return;
    setBusy(true);
    const result = await runMany(targets, (item) => { const updated = { ...item, date: nextDate || item.date, subCategory: nextSub || item.subCategory, mainCategory: nextSub ? mainCategoryFor(nextSub) : item.mainCategory }; return isRaw ? archiveService.updateRaw(item.id, updated) : archiveService.update(item.id, updated); });
    if (isRaw) { await loadRaw(); setRawBulkDate(""); setRawBulkSub(""); } else { await reloadCurrent(); setSelectedMain([]); setBulkDate(""); setBulkSub(""); }
    setBusy(false); alert(`완료 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const removeSelectedMain = async () => {
    if (!selectedMainItems.length || !confirm(`선택한 ${selectedMainItems.length}개 기록을 영구 삭제할까요?`)) return;
    setBusy(true); const result = await runMany(selectedMainItems, (item) => archiveService.remove(item.id)); await reloadCurrent(); setSelectedMain([]); setBusy(false); alert(`삭제 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const publishRaw = async (item) => { setBusy(true); try { await archiveService.publishRaw(item.id); setRawItems((current) => current.filter((raw) => raw.id !== item.id)); setSelectedRaw((current) => current.filter((id) => id !== item.id)); await loadList(1); alert("메인 아카이브에 게시했습니다."); } catch (error) { alert(error.message); } finally { setBusy(false); } };
  const publishSelectedRaw = async () => {
    if (!selectedRawItems.length || !confirm(`선택한 ${selectedRawItems.length}개를 메인 시트에 게시할까요?`)) return;
    setBusy(true); const result = await runMany(selectedRawItems, (item) => archiveService.publishRaw(item.id)); const done = new Set(selectedRawItems.map((item) => item.id)); setRawItems((current) => current.filter((item) => !done.has(item.id))); setSelectedRaw([]); await loadList(1); setBusy(false); alert(`게시 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const removeRaw = async (item) => { if (!confirm(`「${item.title}」 임시 데이터를 삭제할까요?`)) return; setBusy(true); try { await archiveService.removeRaw(item.id); setRawItems((current) => current.filter((raw) => raw.id !== item.id)); } catch (error) { alert(error.message); } finally { setBusy(false); } };
  const removeSelectedRaw = async () => {
    if (!selectedRawItems.length || !confirm(`선택한 ${selectedRawItems.length}개를 Raw 시트에서 영구 삭제할까요?`)) return;
    setBusy(true); const result = await runMany(selectedRawItems, (item) => archiveService.removeRaw(item.id)); const done = new Set(selectedRawItems.map((item) => item.id)); setRawItems((current) => current.filter((item) => !done.has(item.id))); setSelectedRaw([]); setBusy(false); alert(`삭제 ${result.success}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
  };
  const fetchTwitter = async () => {
    if (!twitterId || !twitterFrom || !twitterTo) return alert("트위터 계정과 시작·종료 날짜를 모두 입력해주세요.");
    if (twitterFrom > twitterTo) return alert("시작 날짜가 종료 날짜보다 늦을 수 없습니다.");
    setBusy(true); try { const result = await archiveService.fetchTwitter({ twitterId, startDate: twitterFrom, endDate: twitterTo }); alert(`${result.count || 0}개의 트윗을 Raw 시트에 추가했습니다.`); await loadRaw(); } catch (error) { alert(error.message); } finally { setBusy(false); }
  };
  const toggle = (id, raw = false) => { const setter = raw ? setSelectedRaw : setSelectedMain; setter((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  const toggleAll = (rows, raw = false) => { const setter = raw ? setSelectedRaw : setSelectedMain; const ids = rows.map((item) => item.id); setter((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]); };
  const recordRows = (rows, raw = false, selectable = false) => <div className="mt-4 space-y-2">{rows.map((item)=><article key={item.id} className={cn("flex items-center gap-2 rounded-2xl border bg-white/[.03] p-3", (raw ? selectedRaw : selectedMain).includes(item.id) ? "border-accent/60" : "border-white/10")}>{selectable && <input aria-label={`${item.title} 선택`} type="checkbox" checked={(raw ? selectedRaw : selectedMain).includes(item.id)} onChange={()=>toggle(item.id,raw)} className="h-4 w-4 shrink-0 accent-[#e50000]"/>}{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover"/> : <div className="h-12 w-16 shrink-0 rounded-lg bg-neutral-900"/>}<div className="min-w-0 flex-1"><div className="flex text-[9px] font-bold"><span className="text-accent">{item.subCategory}</span><time className="ml-auto text-neutral-600">{item.date}</time></div><p className="mt-1 line-clamp-2 text-xs font-bold">{item.title}</p></div>{raw ? <><button disabled={busy} onClick={()=>publishRaw(item)} className="rounded-lg bg-accent px-2 py-2 text-[10px] font-black">게시</button><button disabled={busy} onClick={()=>openForm({...item,_raw:true})} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>removeRaw(item)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></> : <><button disabled={busy} onClick={()=>openForm(item)} className="rounded-lg bg-white/5 p-2 text-neutral-400"><Pencil size={14}/></button><button disabled={busy} onClick={()=>remove(item)} className="rounded-lg bg-accent/10 p-2 text-accent"><Trash2 size={14}/></button></>}</article>)}</div>;
  const bulkPanel = (raw = false) => { const count = raw ? selectedRaw.length : selectedMain.length; const date = raw ? rawBulkDate : bulkDate; const sub = raw ? rawBulkSub : bulkSub; return <div className={cn("mt-3 rounded-2xl border p-3",count ? "border-accent/40 bg-accent/5" : "border-white/10 bg-white/[.02]")}><div className="flex items-center"><p className="text-xs font-black">선택 항목 일괄 수정 <span className="text-accent">{count}개</span></p>{count>0&&<button onClick={()=>raw?setSelectedRaw([]):setSelectedMain([])} className="ml-auto text-[10px] font-bold text-neutral-500">선택 해제</button>}</div><div className="mt-3 grid grid-cols-2 gap-2"><AdminInput label="날짜 변경" type="date" value={date} onChange={raw?setRawBulkDate:setBulkDate}/><AdminSelect label="소분류 변경" value={sub} onChange={raw?setRawBulkSub:setBulkSub} options={["변경 안 함",...SUB_CATEGORY_OPTIONS]} emptyValue/></div>{sub&&<p className="mt-2 text-[10px] font-bold text-neutral-500">대분류는 <span className="text-accent">{mainCategoryFor(sub)}</span>로 자동 설정됩니다.</p>}<button disabled={!count||busy} onClick={()=>applyBulk(raw?"raw":"main")} className="mt-3 w-full rounded-xl bg-accent py-2.5 text-xs font-black disabled:bg-neutral-800 disabled:text-neutral-600">선택한 {count}개에 적용</button></div>; };

  return <div className="pt-5">
    <div className="flex items-center"><button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-neutral-500"><ChevronLeft size={15}/>관리자 선택</button></div>
    <div className="mt-4 grid grid-cols-3 border-b border-white/10">{[["list","목록 관리"],["calendar","캘린더 관리"],["import","불러오기"]].map(([key,label])=><button key={key} onClick={()=>{setAdminTab(key);setFormOpen(false);}} className={cn("border-b-2 py-3 text-[11px] font-black",adminTab===key?"border-accent text-white":"border-transparent text-neutral-600")}>{label}</button>)}</div>
    {adminTab === "list" && <><button onClick={() => openForm()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-xs font-black"><Plus size={16}/>새 기록 추가</button><div className="mt-3"><SearchBar value={query} onChange={setQuery} placeholder="관리할 기록 검색"/></div><div className="mt-3 grid grid-cols-2 gap-2"><AdminSelect label="대분류 필터" value={mainFilter} onChange={(value)=>{setMainFilter(value);setSubFilter("전체");}} options={["전체",...Object.keys(CATEGORY_MAP)]}/><AdminSelect label="소분류 필터" value={subFilter} onChange={(value)=>{setSubFilter(value);if(value!=="전체")setMainFilter(mainCategoryFor(value));}} options={["전체",...SUB_CATEGORY_OPTIONS]}/><AdminInput label="시작 날짜" type="date" value={dateFrom} onChange={setDateFrom}/><AdminInput label="종료 날짜" type="date" value={dateTo} onChange={setDateTo}/></div><div className="mt-3 flex items-center"><label className="flex items-center gap-2 text-[11px] font-bold text-neutral-400"><input type="checkbox" checked={items.length>0&&items.every((item)=>selectedMain.includes(item.id))} onChange={()=>toggleAll(items)} className="h-4 w-4 accent-[#e50000]"/>현재 페이지 전체 선택</label><button disabled={!selectedMain.length||busy} onClick={removeSelectedMain} className="ml-auto rounded-lg bg-accent/10 px-3 py-2 text-[10px] font-black text-accent disabled:opacity-40">선택 삭제</button></div>{bulkPanel()}<p className="mt-2 text-right text-[10px] font-bold text-neutral-600">검색 결과 {total}개 · {page}페이지</p></>}
    {adminTab === "calendar" && <div className="mt-4"><div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><div className="flex items-center justify-center gap-2"><AdminSelect label="년도" value={String(adminYear)} onChange={(value)=>{setAdminYear(+value);setAdminDate(`${value}-${pad(adminMonth)}-01`);}} options={adminYears.map(String)}/><AdminSelect label="월" value={String(adminMonth)} onChange={(value)=>{setAdminMonth(+value);setAdminDate(`${adminYear}-${pad(value)}-01`);}} options={Array.from({length:12},(_,i)=>String(i+1))}/></div><div className="mt-4 grid grid-cols-7 text-center text-[9px] font-bold text-neutral-600">{["일","월","화","수","목","금","토"].map((value)=><span key={value}>{value}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-y-1">{Array.from({length:new Date(adminYear,adminMonth-1,1).getDay()}).map((_,i)=><span key={`admin-empty-${i}`}/>)}{Array.from({length:new Date(adminYear,adminMonth,0).getDate()},(_,i)=>i+1).map((value)=>{const date=`${calendarMonthKey}-${pad(value)}`;const has=calendarMonthItems.some((item)=>item.date===date);return <button key={value} onClick={()=>setAdminDate(date)} className={cn("relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",adminDate===date?"bg-accent text-white":"text-neutral-400")}>{value}{has&&adminDate!==date&&<span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent"/>}</button>})}</div></div><div className="mt-4 flex items-center"><p className="text-xs font-black">{adminDate} <span className="text-neutral-500">{calendarItems.length}개</span></p><button onClick={()=>openForm(null,adminDate)} className="ml-auto rounded-lg bg-accent px-3 py-2 text-[10px] font-black">+ 추가</button></div></div>}
    {adminTab === "import" && <div className="mt-4"><div className="rounded-2xl border border-[#1DA1F2]/30 bg-[#1DA1F2]/5 p-4"><h3 className="text-sm font-black text-[#55acee]">트위터 데이터 수집</h3><AdminInput label="트위터 계정 ID (@ 제외)" value={twitterId} onChange={setTwitterId}/><div className="mt-2 grid grid-cols-2 gap-2"><AdminInput label="시작 날짜" type="date" value={twitterFrom} onChange={setTwitterFrom}/><AdminInput label="종료 날짜" type="date" value={twitterTo} onChange={setTwitterTo}/></div><button disabled={busy} onClick={fetchTwitter} className="mt-3 w-full rounded-xl bg-[#1DA1F2] py-3 text-xs font-black disabled:opacity-50">{busy?"수집 중…":"트윗 수집하여 Raw 시트에 추가"}</button></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><h3 className="text-sm font-black">Raw 데이터 조회 및 게시</h3><AdminInput label="계정 필터 (선택)" value={rawAccount} onChange={setRawAccount}/><div className="mt-2 grid grid-cols-2 gap-2"><AdminInput label="시작 날짜" type="date" value={rawFrom} onChange={setRawFrom}/><AdminInput label="종료 날짜" type="date" value={rawTo} onChange={setRawTo}/></div><button disabled={busy} onClick={loadRaw} className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-black">{busy?"불러오는 중…":"Raw 데이터 조회하기"}</button></div>{rawLoaded&&<><div className="mt-3 flex items-center"><label className="flex items-center gap-2 text-[11px] font-bold text-neutral-400"><input type="checkbox" checked={rawFiltered.length>0&&rawFiltered.every((item)=>selectedRaw.includes(item.id))} onChange={()=>toggleAll(rawFiltered,true)} className="h-4 w-4 accent-[#e50000]"/>전체 선택</label><span className="ml-2 text-[10px] font-bold text-neutral-600">{rawFiltered.length}개</span><button disabled={!selectedRaw.length||busy} onClick={removeSelectedRaw} className="ml-auto rounded-lg bg-accent/10 px-2.5 py-2 text-[10px] font-black text-accent disabled:opacity-40">삭제</button><button disabled={!selectedRaw.length||busy} onClick={publishSelectedRaw} className="ml-2 rounded-lg bg-accent px-2.5 py-2 text-[10px] font-black disabled:opacity-40">게시 ({selectedRaw.length})</button></div>{bulkPanel(true)}</>}</div>}
    {formOpen && <form onSubmit={save} className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex items-center"><h3 className="text-sm font-black">{editing ? "기록 수정" : "새 기록"}</h3><button type="button" onClick={() => {setEditing(null);setForm(blank);setFormOpen(false);}} className="ml-auto"><X size={16}/></button></div>
      <div className="grid grid-cols-2 gap-2">
        <AdminInput label="날짜" type="date" value={form.date} onChange={(v)=>update("date",v)} required/>
        <AdminInput label="계정" value={form.account} onChange={(v)=>update("account",v)}/>
        <AdminSelect label="대분류" value={form.mainCategory} onChange={(value)=>setForm((current)=>({...current,mainCategory:value,subCategory:CATEGORY_MAP[value]?.includes(current.subCategory)?current.subCategory:CATEGORY_MAP[value]?.[0]||"기타"}))} options={Object.keys(CATEGORY_MAP)}/>
        <AdminSelect label="소분류" value={form.subCategory} onChange={(v)=>update("subCategory",v)} options={SUB_CATEGORY_OPTIONS}/>
      </div>
      <div className="mt-2 space-y-2"><AdminInput label="제목" value={form.title} onChange={(v)=>update("title",v)} required/><AdminInput label="랜딩 링크" type="url" value={form.link} onChange={(v)=>update("link",v)} required/><AdminInput label="썸네일 URL" type="url" value={form.thumbnailUrl} onChange={(v)=>update("thumbnailUrl",v)}/><AdminInput label="키워드 (쉼표 구분)" value={form.rawKeywords} onChange={(v)=>update("rawKeywords",v)}/></div>
      <button disabled={busy} className="mt-3 w-full rounded-xl bg-white py-3 text-xs font-black text-black disabled:opacity-50">{busy ? "저장 중…" : "Supabase에 저장"}</button>
    </form>}
    {adminTab === "list" && (loading ? <div className="mt-4"><ListSkeleton/></div> : loadError ? <LoadError message={loadError}/> : <>{recordRows(items,false,true)}<div className="mt-4 grid grid-cols-2 gap-2"><button disabled={page<=1||loading} onClick={()=>loadList(page-1)} className="rounded-xl bg-white/5 py-3 text-xs font-bold disabled:opacity-30">이전</button><button disabled={page*100>=total||loading} onClick={()=>loadList(page+1)} className="rounded-xl bg-white/5 py-3 text-xs font-bold disabled:opacity-30">다음</button></div></>)}
    {adminTab === "calendar" && (calendarLoading ? <div className="mt-4"><ListSkeleton/></div> : calendarError ? <LoadError message={calendarError}/> : recordRows(calendarItems))}
    {adminTab === "import" && rawLoaded && recordRows(rawFiltered.slice(0,100), true, true)}
  </div>;
}

function AdminInput({ label, value, onChange, type = "text", required = false }) {
  return <label className="block"><span className="mb-1 ml-1 block text-[9px] font-bold text-neutral-600">{label}</span><input required={required} type={type} value={value || ""} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs outline-none focus:border-accent"/></label>;
}

function AdminSelect({ label, value, onChange, options, emptyValue = false }) {
  return <label className="block min-w-0"><span className="mb-1 ml-1 block text-[9px] font-bold text-neutral-600">{label}</span><select value={value} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-2 py-2.5 text-xs outline-none focus:border-accent">{options.map((option,index)=><option key={`${option}-${index}`} value={emptyValue&&index===0?"":option}>{option}</option>)}</select></label>;
}

function ArchiveSkeleton() {
  return <div aria-label="기록 불러오는 중" className="grid grid-cols-2 gap-x-3 gap-y-5">{Array.from({length:6},(_,index)=><div key={index} className="animate-pulse"><div className="aspect-[16/9] rounded-xl bg-neutral-900"/><div className="mt-2 flex items-center"><span className="h-3 w-12 rounded bg-neutral-900"/><span className="ml-auto h-2.5 w-16 rounded bg-neutral-900"/></div><div className="mt-2 h-3 w-full rounded bg-neutral-900"/><div className="mt-1.5 h-3 w-2/3 rounded bg-neutral-900"/></div>)}</div>;
}

function ListSkeleton() {
  return <div aria-label="데이터 불러오는 중" className="space-y-3">{Array.from({length:4},(_,index)=><div key={index} className="flex animate-pulse gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-3"><div className="h-14 w-16 rounded-xl bg-neutral-900"/><div className="flex-1"><div className="h-3 w-1/3 rounded bg-neutral-900"/><div className="mt-3 h-3 w-full rounded bg-neutral-900"/><div className="mt-2 h-3 w-2/3 rounded bg-neutral-900"/></div></div>)}</div>;
}

function LoadError({ message }) {
  return <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-10 text-center"><p className="text-xs font-bold text-neutral-400">{message}</p><p className="mt-2 text-[10px] text-neutral-600">잠시 후 다시 시도해주세요.</p></div>;
}

function EmptyState({text}) { return <div className="flex flex-col items-center py-20 text-center"><Archive size={28} className="text-neutral-800"/><p className="mt-3 text-xs font-bold text-neutral-600">{text}</p></div> }

function BottomNav({tab,onChange}) { const items=[["home",Home,"홈"],["calendar",CalendarDays,"캘린더"],["recommended",Video,"추천"],["postype",Search,"포타"]]; return <nav className="safe-bottom absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-3 pt-2 backdrop-blur-2xl"><div className="grid grid-cols-4">{items.map(([key,Icon,label])=><button key={key} onClick={()=>onChange(key)} className={cn("relative flex flex-col items-center gap-1 py-1 text-[10px] font-bold transition",tab===key?"text-white":"text-neutral-600")}><span className={cn("rounded-2xl px-4 py-1.5 transition",tab===key&&"bg-accent/15 text-accent")}><Icon size={20} strokeWidth={tab===key?2.6:2}/></span>{label}{tab===key&&<span className="absolute -bottom-1 h-1 w-1 rounded-full bg-accent"/>}</button>)}</div></nav> }
