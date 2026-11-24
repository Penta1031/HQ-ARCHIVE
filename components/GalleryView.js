"use client";

import * as jsxRuntime from "react/jsx-runtime";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  CalendarDays as CalendarIcon, X as CloseIcon, ChevronLeft as PreviousIcon,
  ChevronRight as NextIcon, Plus as AddIcon, Images as GalleryIcon,
  Play as PlayIcon, ChevronUp as UpIcon, ArrowUpDown as SortIcon
} from "lucide-react";
import { adminRequest, analyticsService, supabaseRequest, tweetMediaService } from "../lib/archive-supabase";
import snapshot from "../data/gallery-records.json";
import duplicateGroups from "../data/gallery-duplicate-groups.json";

async function lookupTweetMedia(url, options) {
  const media = await tweetMediaService.resolve(url, options);
  if (!media) throw new Error("트위터 미디어를 불러오지 못했어요.");
  return media;
}

async function loadCategoryMap() {
  const [categories, subcategories] = await Promise.all([
    supabaseRequest("hq_archive_categories?select=id,name&is_active=eq.true&order=sort_order.asc,id.asc"),
    supabaseRequest("hq_archive_subcategories?select=category_id,name&is_active=eq.true&order=sort_order.asc,id.asc")
  ]);
  return Object.fromEntries(categories.rows.map(category => [
    category.name,
    subcategories.rows.filter(item => item.category_id === category.id).map(item => item.name)
  ]));
}

const archiveChangeEvent = "hq-archive-records-changed";
const notifyArchiveChange = () => window.dispatchEvent(new Event(archiveChangeEvent));

let pad = t => String(t).padStart(2, "0");

let localDate = t => "".concat(t.getFullYear(), "-").concat(pad(t.getMonth() + 1), "-").concat(pad(t.getDate()));

function GalleryDatePicker(t) {
  let {
      value: e,
      onChange: a,
      counts: l,
      partialCounts = false
    } = t,
    [o, m] = React.useState(!1),
    [n, c] = React.useState(() => (e || [...l.keys()].sort().at(-1) || new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul"
    }).format(new Date())).slice(0, 7)),
    d = React.useRef(null),
    p = React.useRef(null),
    [g, u] = n.split("-").map(Number),
    h = [...new Set([g, new Date().getFullYear(), ...(partialCounts ? Array.from({ length: Math.max(0, new Date().getFullYear() - 2017 + 1) }, (_, index) => 2017 + index) : []), ...[...l.keys()].map(t => Number(t.slice(0, 4)))])].sort((t, e) => e - t),
    b = new Date(g, u - 1, 1).getDay(),
    x = new Date(g, u, 0).getDate(),
    w = t => c(localDate(new Date(g, u - 1 + t, 1)).slice(0, 7)),
    y = t => {
      var e;
      a(t), m(!1), null === (e = p.current) || void 0 === e || e.focus();
    };
  return React.useEffect(() => {
    if (!o) return;
    let t = t => {
      var e;
      (null === (e = d.current) || void 0 === e ? void 0 : e.contains(t.target)) || m(!1);
    };
    return document.addEventListener("pointerdown", t), () => document.removeEventListener("pointerdown", t);
  }, [o]), jsxRuntime.jsxs("div", {
    ref: d,
    className: "relative",
    onKeyDown: t => {
      if ("Escape" === t.key) {
        var e;
        m(!1), null === (e = p.current) || void 0 === e || e.focus();
      }
    },
    children: [jsxRuntime.jsxs("div", {
      className: "flex items-center gap-2",
      children: [jsxRuntime.jsxs("button", {
        ref: p,
        "aria-label": "갤러리 날짜 선택",
        "aria-expanded": o,
        onClick: () => {
          o || c((e || [...l.keys()].sort().at(-1) || n).slice(0, 7)), m(t => !t);
        },
        className: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-neutral-300",
        children: [jsxRuntime.jsx(CalendarIcon, {
          size: 17
        }), e ? e.replace(/-/g, ".") : "날짜 선택"]
      }), e && jsxRuntime.jsx("button", {
        onClick: () => a(""),
        className: "px-2 py-2 text-xs text-neutral-400",
        children: "전체 보기"
      }), 10 === e.length && jsxRuntime.jsx("div", {
        className: "ml-auto flex gap-1",
        children: [-1, 1].map(t => jsxRuntime.jsx("button", {
          "aria-label": t < 0 ? "이전 날짜" : "다음 날짜",
          onClick: () => {
            let [i, s, l] = e.split("-").map(Number);
            a(localDate(new Date(i, s - 1, l + t)));
          },
          className: "rounded-lg border border-white/10 p-2 text-neutral-400",
          children: t < 0 ? jsxRuntime.jsx(PreviousIcon, {
            size: 15
          }) : jsxRuntime.jsx(NextIcon, {
            size: 15
          })
        }, t))
      })]
    }), o && jsxRuntime.jsxs("div", {
      role: "group",
      "aria-label": "갤러리 달력",
      className: "absolute inset-x-0 top-12 z-30 rounded-2xl border border-white/15 bg-neutral-950 p-3 shadow-2xl",
      children: [jsxRuntime.jsxs("div", {
        className: "flex items-center justify-between gap-2",
        children: [jsxRuntime.jsx("button", {
          "aria-label": "이전 달",
          onClick: () => w(-1),
          className: "rounded-lg p-2 text-neutral-400",
          children: jsxRuntime.jsx(PreviousIcon, {
            size: 17
          })
        }), jsxRuntime.jsxs("div", {
          className: "flex gap-1",
          children: [jsxRuntime.jsx("select", {
            "aria-label": "갤러리 연도",
            value: g,
            onChange: t => c("".concat(t.target.value, "-").concat(pad(u))),
            className: "rounded-lg bg-neutral-900 p-2 text-sm",
            children: h.map(t => jsxRuntime.jsxs("option", {
              value: t,
              children: [t, "년"]
            }, t))
          }), jsxRuntime.jsx("select", {
            "aria-label": "갤러리 월",
            value: u,
            onChange: t => c("".concat(g, "-").concat(pad(t.target.value))),
            className: "rounded-lg bg-neutral-900 p-2 text-sm",
            children: Array.from({
              length: 12
            }, (t, e) => jsxRuntime.jsxs("option", {
              value: e + 1,
              children: [e + 1, "월"]
            }, e))
          })]
        }), jsxRuntime.jsx("button", {
          "aria-label": "다음 달",
          onClick: () => w(1),
          className: "rounded-lg p-2 text-neutral-400",
          children: jsxRuntime.jsx(NextIcon, {
            size: 17
          })
        })]
      }), jsxRuntime.jsx("div", {
        className: "mt-3 grid grid-cols-7 text-center text-xs text-neutral-500",
        children: ["일", "월", "화", "수", "목", "금", "토"].map(t => jsxRuntime.jsx("span", {
          children: t
        }, t))
      }), jsxRuntime.jsxs("div", {
        className: "mt-2 grid grid-cols-7 gap-y-1",
        children: [Array.from({
          length: b
        }, (t, e) => jsxRuntime.jsx("span", {}, "blank-".concat(e))), Array.from({
          length: x
        }, (t, a) => {
          let s = a + 1,
            o = "".concat(n, "-").concat(pad(s)),
            r = l.get(o) || 0;
          return jsxRuntime.jsxs("button", {
            "aria-label": `${g}년 ${u}월 ${s}일` + (partialCounts ? "" : `, 콘텐츠 ${r}개`),
            "aria-pressed": e === o,
            onClick: () => y(o),
            className: "relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm ".concat(e === o ? "bg-accent text-white" : r ? "font-bold text-white hover:bg-white/10" : "text-neutral-600 hover:bg-white/5"),
            children: [s, r > 0 && jsxRuntime.jsx("span", {
              className: "absolute bottom-1 h-1 w-1 rounded-full bg-accent"
            })]
          }, o);
        })]
      }), jsxRuntime.jsxs("div", {
        className: "mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs",
        children: [jsxRuntime.jsx("span", {
          className: "text-neutral-500",
          children: partialCounts ? "빨간 점 · 불러온 기록이 있는 날" : "빨간 점 · 기록이 있는 날"
        }), jsxRuntime.jsx("button", {
          onClick: () => y(n),
          className: "rounded-lg bg-white/10 px-3 py-2 text-neutral-300",
          children: "이 달 전체"
        })]
      })]
    })]
  });
}

function SectionLabel(t) {
  let {
    label: e,
    count: a,
    showCount: s = !0,
    unit: l = "개",
    sortOrder: o,
    sortLabels: r = {
      desc: "최신순",
      asc: "과거순"
    },
    onSort: m
  } = t;
  return jsxRuntime.jsxs("div", {
    className: "mb-3 mt-6 flex items-center gap-3",
    children: [jsxRuntime.jsxs("p", {
      className: "text-xs text-neutral-400",
      children: [e, s && jsxRuntime.jsxs(jsxRuntime.Fragment, {
        children: [" ", jsxRuntime.jsxs("b", {
          className: "text-white",
          children: [a, l]
        })]
      })]
    }), m && jsxRuntime.jsxs("button", {
      onClick: m,
      className: "ml-auto flex items-center gap-1 text-xs font-bold text-neutral-400",
      children: [jsxRuntime.jsx(SortIcon, {
        size: 13
      }), "desc" === o ? r.desc : r.asc]
    })]
  });
}

function galleryImageKey(t) {
  try {
    let e = new URL(t);
    if (!/^https?:$/.test(e.protocol)) return "";
    return e.hash = "", "pbs.twimg.com" === e.hostname && (e.search = "", e.protocol = "https:", e.pathname = e.pathname.replace(/:(small|medium|large|orig)$/, "").replace(/\.(jpg|jpeg|png|webp)$/i, "")), e.href;
  } catch (t) {
    return "";
  }
}

function isGalleryRecord(t) {
  if ((t.keywords || []).includes("갤러리:직접등록")) return !0;
  let e = String(t.mainCategory || t.main_category || "").trim(),
    a = String(t.subCategory || t.sub_category || "").trim();
  return !["무대영상", "라이브"].includes(e) && ("유튜브" !== e || !!/^(쇼츠|숏츠)$/.test(a)) && (!!(/^(릴스|쇼츠|숏츠|틱톡)$/.test(a) || (t.keywords || []).some(t => /투\s*샷|셀카|커플\s*사진|^갤러리:(커플릴스|쇼츠)$/.test(t))) || /투\s*샷|투\s*쇼트|two[\s-]*shots?|셀카(?!봉)|거셀|인생네컷|포토이즘|릴스|쇼츠|숏츠|reels|shorts|챌린지|커플\s*(?:사진|샷)|유닛\s*포카|(?:둘이|둘의|둘만|두\s*사람|함께|같이)[\s\S]{0,24}(?:사진|찍|포카)|(?:사진|찍)[\s\S]{0,24}(?:둘이|둘의|둘만|두\s*사람|함께|같이)/i.test(t.title || ""));
}

let galleryClassifications = [{
  key: "selfie",
  label: "사진 \xb7 셀카",
  keyword: "갤러리:셀카",
  main: "image",
  sub: "셀카"
}, {
  key: "twoshot",
  label: "사진 \xb7 투샷",
  keyword: "갤러리:투샷",
  main: "image",
  sub: "투샷"
}, {
  key: "reels",
  label: "영상 \xb7 커플릴스",
  keyword: "갤러리:커플릴스",
  main: "video",
  sub: "커플릴스"
}, {
  key: "shorts",
  label: "영상 \xb7 쇼츠",
  keyword: "갤러리:쇼츠",
  main: "video",
  sub: "쇼츠"
}];

function applyGalleryClassification(t, e) {
  let a = t.filter(t => !galleryClassifications.some(e => e.keyword === t)),
    i = galleryClassifications.find(t => t.key === e);
  return i && a.push(i.keyword), [...new Set(a)];
}

let postTypes = {
  twitter: {
    label: "X / 트위터",
    mainCategory: "SNS",
    subCategory: "공식 트위터"
  },
  instagram: {
    label: "인스타그램 사진",
    mainCategory: "SNS",
    subCategory: "공식 인스타그램"
  },
  reels: {
    label: "인스타그램 릴스",
    mainCategory: "SNS",
    subCategory: "릴스"
  },
  shorts: {
    label: "유튜브 영상",
    mainCategory: "유튜브",
    subCategory: "쇼츠"
  },
  tiktok: {
    label: "틱톡",
    mainCategory: "SNS",
    subCategory: "틱톡"
  },
  other: {
    label: "기타 사진\xb7영상",
    mainCategory: "기타",
    subCategory: "기타"
  }
};

let safeUrl = t => {
  try {
    let e = new URL(String(t || "").trim());
    return /^https?:$/.test(e.protocol) ? e.href : "";
  } catch (t) {
    return "";
  }
};

function galleryPostLinkKey(t) {
  let e = safeUrl(t);
  if (!e) return "";
  let a = new URL(e),
    i = a.hostname.match(/^(?:(?:www|mobile)\.)?(?:x|twitter)\.com$/i) && a.pathname.match(/\/(?:status|statuses)\/(\d+)/);
  return i ? "tweet:".concat(i[1]) : (a.hash = "", ["s", "t", "utm_source", "utm_medium", "utm_campaign", "igsh"].forEach(t => a.searchParams.delete(t)), a.href.replace(/\/$/, ""));
}

function makeGalleryPost(t) {
  let e = safeUrl(t.link);
  if (!e) throw Error("올바른 게시물 링크를 입력해주세요.");
  let a = String(t.title || "").trim();
  if (!a) throw Error("제목 또는 게시물 내용을 입력해주세요.");
  let i = String(t.date || "").trim(),
    s = new Date("".concat(i, "T00:00:00Z"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i) || Number.isNaN(s.getTime()) || s.toISOString().slice(0, 10) !== i) throw Error("올바른 날짜를 선택해주세요.");
  let l = postTypes[t.postType];
  if (!l) throw Error("게시물 종류를 선택해주세요.");
  let o = t.mainCategory && t.subCategory ? {
      mainCategory: t.mainCategory,
      subCategory: t.subCategory
    } : l,
    r = safeUrl(t.thumbnailUrl);
  if (!r) throw Error("사진 또는 영상의 미리보기 이미지 주소를 입력해주세요.");
  let m = applyGalleryClassification([...new Set([...(t.keywords || []), "투샷", ...(t.archiveId ? [] : ["갤러리:직접등록"])])], t.galleryClassification || "");
  return {
    title: a,
    date: i,
    link: e,
    thumbnailUrl: r,
    account: String(t.account || "").trim(),
    mainCategory: o.mainCategory,
    subCategory: o.subCategory,
    keywords: m,
    rawKeywords: m.join(", "),
    sourceType: "manual"
  };
}

let catalogPromise = null;

let catalogAt = 0;

let snapshotById = new Map(snapshot.map(t => [String(t.id), t]));

let searchTerms = ["투", "셀카", "거셀", "인생네컷", "포토이즘", "커플", "함께", "같이", "둘", "두 사람", "두사람", "유닛", "two", "릴스", "쇼츠", "숏츠", "reels", "shorts", "챌린지"];

async function findArchivePost(t) {
  let e = galleryPostLinkKey(t),
    a = new URLSearchParams({
      select: "*",
      limit: "100"
    });
  e.startsWith("tweet:") ? a.set("source_url", "like.*".concat(e.slice(6), "*")) : a.set("source_url", "eq.".concat(t));
  let {
      rows: i
    } = await supabaseRequest("hq_archive_public?".concat(a)),
    s = i.find(t => galleryPostLinkKey(t.source_url) === e);
  return s ? {
    id: s.id,
    archiveId: s.id,
    title: s.title || "",
    date: s.occurred_on || "",
    link: s.source_url,
    thumbnailUrl: s.thumbnail_url || "",
    account: s.account || "",
    mainCategory: s.main_category || "",
    subCategory: s.sub_category || "",
    keywords: s.keywords || []
  } : null;
}

const GALLERY_PAGE_SIZE = 30;
const GALLERY_METADATA_BATCH_SIZE = 150;

async function readGalleryRecords({ cursor, limit, order = "desc", date = "", signal, publicGallery = false }) {
  const params = new URLSearchParams({
    select: "id,title,occurred_on,source_url,thumbnail_url,keywords,main_category,sub_category",
    order: `occurred_on.${order}.nullslast,id.${order}`,
    limit: String(limit),
    or: `(${searchTerms.map(term => `title.ilike.*${term}*`).join(",")},keywords.cs.{갤러리:직접등록},keywords.cs.{투샷},keywords.cs.{갤러리:셀카},keywords.cs.{갤러리:투샷},keywords.cs.{갤러리:커플릴스},keywords.cs.{갤러리:쇼츠},sub_category.in.(릴스,쇼츠,숏츠,틱톡))`
  });
  if (date.length === 10) params.set("occurred_on", `eq.${date}`);
  if (date.length === 7) {
    const [year, month] = date.split("-").map(Number);
    params.append("occurred_on", `gte.${date}-01`);
    params.append("occurred_on", `lt.${localDate(new Date(year, month, 1))}`);
  }
  const conditions = [];
  if (publicGallery) {
    conditions.push("or(keywords.cs.{갤러리:직접등록},main_category.is.null,main_category.not.in.(무대영상,라이브,유튜브),and(main_category.eq.유튜브,sub_category.in.(쇼츠,숏츠)))");
  }
  if (cursor) {
    const operator = order === "asc" ? "gt" : "lt";
    const { id, date: cursorDate } = cursor;
    const after = cursorDate
      ? `or(occurred_on.${operator}.${cursorDate},and(occurred_on.eq.${cursorDate},id.${operator}.${id}),occurred_on.is.null)`
      : `and(occurred_on.is.null,id.${operator}.${id})`;
    conditions.push(after);
  }
  if (conditions.length) params.set("and", `(${conditions.join(",")})`);
  const { rows } = await supabaseRequest(`hq_archive_public?${params}`, { signal });
  const last = rows.at(-1);
  return {
    nextCursor: rows.length === limit ? { id: last.id, date: last.occurred_on } : null,
    records: rows.map(row => ({
      id: row.id,
      title: row.title || "",
      date: row.occurred_on || "",
      link: row.source_url || "",
      thumbnailUrl: row.thumbnail_url || "",
      keywords: row.keywords || [],
      mainCategory: row.main_category || "",
      subCategory: row.sub_category || ""
    })).filter(isGalleryRecord)
  };
}

async function resolveGalleryMedia(t, signal) {
  let e = 0,
    a = Array(t.length);
  await Promise.all(Array.from({
    length: 3
  }, async () => {
    for (; e < t.length;) {
      signal?.throwIfAborted();
      let i = e++,
        s = t[i],
        l = snapshotById.get(String(s.id));
      if (l && l.link === s.link && l.thumbnailUrl === s.thumbnailUrl) {
        a[i] = {
          ...l,
          ...s
        };
        continue;
      }
      let o = [],
        r = !1;
      if (/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\//i.test(s.link)) try {
        let t = await lookupTweetMedia(s.link, {
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12e3)]) : AbortSignal.timeout(12e3)
        });
        o = t.media || (t.images || []).map(t => ({
          url: "string" == typeof t ? t : t.url,
          type: "image"
        })), t.isVideo && t.url && !o.some(e => e.url === t.url) && o.push({
          url: t.url,
          type: "video",
          poster: t.thumbnailUrl || s.thumbnailUrl
        }), !o.length && t.url && (o = [{
          url: t.url,
          type: t.isVideo ? "video" : "image",
          poster: t.thumbnailUrl
        }]);
      } catch (t) {
        r = !0;
      }
      !o.length && /\.(mp4|webm)(?:$|\?)/i.test(s.link) && (o = [{
        url: s.link,
        type: "video",
        poster: s.thumbnailUrl
      }]), !o.length && s.thumbnailUrl && (o = /video|youtube|youtu\.be|instagram.*\/reel|\/shorts\//i.test(s.thumbnailUrl + s.link) ? [{
        url: s.link,
        poster: s.thumbnailUrl,
        type: "video",
        external: !0
      }] : [{
        url: s.thumbnailUrl,
        type: "image"
      }]), a[i] = {
        ...s,
        media: o.filter(t => galleryImageKey(t.url)),
        mediaFailed: r
      };
    }
  }));
  return a;
}

let galleryService = {
  invalidate() {
    catalogPromise = null, catalogAt = 0;
    warmedGallery = null;
  },
  async bulkClassification(t, e) {
    let a = arguments.length > 2 && void 0 !== arguments[2] && arguments[2],
      i = await adminRequest("gallery-classification-bulk", {
        ids: [...new Set(t.map(String))],
        category: e,
        ...(a ? {
          includeInGallery: !0
        } : {})
      });
    return catalogPromise = null, catalogAt = 0, {
      updatedIds: (i.updatedIds || []).map(String),
      failedIds: (i.failedIds || []).map(String)
    };
  },
  async lookup(t) {
    var e, a;
    let i = await findArchivePost(t);
    if (i) {
      let e = snapshotById.get(String(i.id)),
        a = (null == e ? void 0 : e.link) === i.link && (null == e ? void 0 : e.thumbnailUrl) === i.thumbnailUrl && e.media || [];
      if (!a.length && /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\//i.test(t)) try {
        a = (await lookupTweetMedia(t, {
          signal: AbortSignal.timeout(15e3)
        })).media || [];
      } catch (t) {}
      return {
        ...i,
        media: a
      };
    }
    if (!/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\//i.test(t)) throw Error("아카이브에 없는 링크예요. X 링크는 자동으로 불러올 수 있고, 다른 게시물은 직접 입력할 수 있어요.");
    let s = await lookupTweetMedia(t, {
        signal: AbortSignal.timeout(15e3)
      }),
      l = s.media || (s.images || []).map(t => ({
        url: "string" == typeof t ? t : t.url,
        type: "image"
      }));
    return s.url && !l.some(t => t.url === s.url) && l.push({
      url: s.url,
      type: s.isVideo ? "video" : "image",
      poster: s.thumbnailUrl
    }), {
      title: s.title || "",
      date: s.date || "",
      account: s.account || "",
      thumbnailUrl: s.thumbnailUrl || (null === (e = l[0]) || void 0 === e ? void 0 : e.poster) || ((null === (a = l[0]) || void 0 === a ? void 0 : a.type) === "image" ? l[0].url : ""),
      media: l
    };
  },
  async create(t) {
    let e = await findArchivePost(t.link);
    if (e) {
      if (String(t.archiveId || "") !== String(e.id)) throw Error("이미 아카이브에 등록된 게시물이에요. 링크 정보를 먼저 불러와주세요.");
      let a = makeGalleryPost({
        ...t,
        ...e,
        thumbnailUrl: e.thumbnailUrl || t.thumbnailUrl
      });
      if (!(await galleryService.bulkClassification([e.id], t.galleryClassification, !0)).updatedIds.includes(String(e.id))) throw Error("갤러리 분류를 반영하지 못했어요. 다시 시도해주세요.");
      let i = /^갤러리:(셀카|투샷|커플릴스|쇼츠)$/;
      return {
        ...e,
        keywords: [...new Set([...e.keywords.filter(t => !i.test(t)), ...a.keywords.filter(t => i.test(t)), "갤러리:직접등록"])]
      };
    }
    let a = makeGalleryPost(t),
      i = await adminRequest("archive-create", {
        item: a,
        status: "published"
      });
    return catalogPromise = null, catalogAt = 0, {
      ...a,
      ...i.item
    };
  },
  async list() {
    let {
      refresh: t = !1
    } = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
    return catalogPromise && !t && Date.now() - catalogAt < 3e5 ? catalogPromise : (catalogAt = Date.now(), catalogPromise = (async () => {
      const records = [];
      let cursor = null;
      do {
        const page = await readGalleryRecords({ cursor, limit: 1000 });
        records.push(...page.records);
        cursor = page.nextCursor;
      } while (cursor);
      return resolveGalleryMedia(records);
    })().catch(t => {
      throw catalogPromise = null, t;
    }));
  },
  async hiddenKeys() {
    let t = [];
    for (let e = 0;; e += 1e3) {
      let {
        rows: a
      } = await supabaseRequest("hq_gallery_hidden?select=media_key&order=media_key&limit=1000&offset=".concat(e));
      if (t.push(...a.map(t => t.media_key)), a.length < 1e3) return t;
    }
  },
  setHidden: async (t, e) => adminRequest("gallery-image-visibility", {
    mediaKey: t,
    hidden: e
  })
};

let inputClass = "mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-accent";

let todayKst = () => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul"
}).format(new Date());

function GalleryPostForm(t) {
  let {
      source: e,
      onCreated: a,
      onCancel: l
    } = t,
    [o, r] = React.useState({
      link: "",
      title: "",
      date: todayKst(),
      postType: "twitter",
      thumbnailUrl: "",
      account: "",
      galleryClassification: "twoshot",
      mainCategory: "",
      subCategory: "",
      keywords: [],
      archiveId: null
    }),
    [m, n] = React.useState([]),
    [c, d] = React.useState(!1),
    [p, g] = React.useState(""),
    [u, h] = React.useState({}),
    [b, x] = React.useState(""),
    [w, y] = React.useState(0);
  React.useEffect(() => {
    let t = !0;
    return x(""), loadCategoryMap().then(e => {
      t && h(e);
    }).catch(() => {
      t && x("카테고리를 불러오지 못했어요.");
    }), () => {
      t = !1;
    };
  }, [w]);
  let j = React.useRef(""),
    f = (t, e) => r(a => ({
      ...a,
      [t]: e
    })),
    v = t => {
      j.current = t, n([]), g("");
      let e = {
        link: t,
        title: "",
        thumbnailUrl: "",
        account: "",
        mainCategory: "",
        subCategory: "",
        keywords: [],
        archiveId: null,
        postType: "twitter",
        galleryClassification: "twoshot"
      };
      try {
        let i = new URL(t);
        if (/(^|\.)(youtube\.com|youtu\.be)$/.test(i.hostname)) {
          var a;
          let t = (null === (a = i.pathname.match(/\/shorts\/([\w-]+)/)) || void 0 === a ? void 0 : a[1]) || ("youtu.be" === i.hostname ? i.pathname.slice(1) : i.searchParams.get("v"));
          e.postType = "shorts", e.galleryClassification = "shorts", t && /^[\w-]{11}$/.test(t) && (e.thumbnailUrl = "https://i.ytimg.com/vi/".concat(t, "/hqdefault.jpg"));
        } else /(^|\.)instagram\.com$/.test(i.hostname) ? (e.postType = /\/reels?\//.test(i.pathname) ? "reels" : "instagram", e.galleryClassification = "reels" === e.postType ? "reels" : "twoshot") : /(^|\.)tiktok\.com$/.test(i.hostname) ? (e.postType = "tiktok", e.galleryClassification = "reels") : /(^|\.)(x|twitter)\.com$/.test(i.hostname) ? e.postType = "twitter" : (/\.(jpg|jpeg|png|webp|gif)(?:$|[?#])/i.test(t) || "pbs.twimg.com" === i.hostname) && (e.postType = "other", e.thumbnailUrl = t);
      } catch (t) {}
      r(t => ({
        ...t,
        ...e
      }));
    },
    k = async () => {
      let t = o.link.trim();
      d(!0), g("");
      try {
        let a = await e.lookup(t);
        if (j.current.trim() !== t) return;
        r(t => {
          var e, i;
          return {
            ...t,
            archiveId: null !== (i = a.archiveId) && void 0 !== i ? i : null,
            mainCategory: a.mainCategory || t.mainCategory,
            subCategory: a.subCategory || t.subCategory,
            keywords: a.keywords || [],
            title: a.title || t.title,
            date: a.date || t.date,
            account: a.account || "",
            thumbnailUrl: a.thumbnailUrl || t.thumbnailUrl,
            galleryClassification: (null === (e = galleryClassifications.find(t => (a.keywords || []).includes(t.keyword))) || void 0 === e ? void 0 : e.key) || ((a.media || []).some(t => "video" === t.type) ? /쇼츠|숏츠|shorts/i.test("".concat(a.subCategory || "", " ").concat(a.title || "")) ? "shorts" : "reels" : /셀카|거셀/.test(a.title) ? "selfie" : "twoshot")
          };
        }), n(a.media || []);
      } catch (t) {
        g(t.message || "게시물 정보를 가져오지 못했어요. 직접 입력해 등록할 수 있어요.");
      } finally {
        d(!1);
      }
    },
    A = async t => {
      t.preventDefault(), g("");
      try {
        if (!o.archiveId && !(u[o.mainCategory] || []).includes(o.subCategory)) throw Error("하위 카테고리를 선택해주세요.");
        let t = makeGalleryPost(o),
          i = ["reels", "shorts"].includes(o.galleryClassification) || ["reels", "shorts", "tiktok"].includes(o.postType) || /\.(mp4|webm)(?:$|\?)/i.test(t.link) ? [{
            url: t.link,
            type: "video",
            poster: t.thumbnailUrl,
            external: !/\.(mp4|webm)(?:$|\?)/i.test(t.link)
          }] : [{
            url: t.thumbnailUrl,
            type: "image"
          }];
        d(!0);
        let s = await e.create({
          ...o,
          media: m.length ? m : i
        });
        a({
          ...s,
          media: m.length ? m : i
        });
      } catch (t) {
        g(t.message || "게시물을 등록하지 못했어요.");
      } finally {
        d(!1);
      }
    };
  return jsxRuntime.jsxs("form", {
    onSubmit: A,
    className: "mb-5 rounded-2xl border border-white/15 bg-neutral-900/70 p-4",
    children: [jsxRuntime.jsx("h3", {
      className: "text-sm font-bold",
      children: "갤러리 게시물 추가"
    }), jsxRuntime.jsx("p", {
      className: "mt-2 text-xs leading-5 text-neutral-400",
      children: "기존 아카이브 링크는 원본 분류를 그대로 가져옵니다. 새 X 링크는 사진\xb7영상을 자동으로 가져올 수 있어요."
    }), jsxRuntime.jsxs("fieldset", {
      disabled: c,
      className: "mt-4 space-y-3 disabled:opacity-60",
      children: [jsxRuntime.jsxs("label", {
        className: "block text-xs text-neutral-400",
        children: ["게시물 링크", jsxRuntime.jsx("input", {
          required: !0,
          type: "url",
          value: o.link,
          onChange: t => v(t.target.value),
          className: inputClass,
          placeholder: "https://x.com/… 또는 사진\xb7영상 링크"
        })]
      }), jsxRuntime.jsx("button", {
        type: "button",
        onClick: k,
        disabled: !o.link.trim(),
        className: "rounded-xl border border-white/15 px-3 py-2 text-xs text-neutral-200 disabled:opacity-40",
        children: "링크 정보 불러오기"
      }), !o.archiveId && jsxRuntime.jsxs("label", {
        className: "block text-xs text-neutral-400",
        children: ["게시물 종류", jsxRuntime.jsx("select", {
          value: o.postType,
          onChange: t => f("postType", t.target.value),
          className: inputClass,
          children: Object.entries(postTypes).map(t => {
            let [e, a] = t;
            return jsxRuntime.jsx("option", {
              value: e,
              children: a.label
            }, e);
          })
        })]
      }), jsxRuntime.jsxs("div", {
        className: "grid grid-cols-2 gap-3",
        children: [jsxRuntime.jsxs("label", {
          className: "block text-xs text-neutral-400",
          children: ["상위 카테고리", jsxRuntime.jsx("input", {
            readOnly: !0,
            value: o.mainCategory,
            placeholder: "하위 분류 선택 시 자동 설정",
            className: inputClass
          })]
        }), jsxRuntime.jsxs("label", {
          className: "block text-xs text-neutral-400",
          children: ["하위 카테고리", o.archiveId ? jsxRuntime.jsx("input", {
            readOnly: !0,
            value: o.subCategory,
            className: inputClass
          }) : jsxRuntime.jsxs("select", {
            required: !0,
            value: o.subCategory ? JSON.stringify([o.mainCategory, o.subCategory]) : "",
            onChange: t => {
              let [e, a] = JSON.parse(t.target.value);
              r(t => ({
                ...t,
                mainCategory: e,
                subCategory: a
              }));
            },
            className: inputClass,
            children: [jsxRuntime.jsx("option", {
              value: "",
              disabled: !0,
              children: Object.keys(u).length ? "하위 카테고리 선택" : "카테고리 불러오는 중…"
            }), Object.entries(u).map(t => {
              let [e, a] = t;
              return jsxRuntime.jsx("optgroup", {
                label: e,
                children: a.map(t => jsxRuntime.jsx("option", {
                  value: JSON.stringify([e, t]),
                  children: t
                }, t))
              }, e);
            })]
          })]
        })]
      }), !o.archiveId && b && jsxRuntime.jsxs("p", {
        role: "alert",
        className: "text-xs text-red-300",
        children: [b, " ", jsxRuntime.jsx("button", {
          type: "button",
          onClick: () => y(t => t + 1),
          className: "underline",
          children: "다시 불러오기"
        })]
      }), o.archiveId && jsxRuntime.jsx("p", {
        role: "status",
        className: "text-xs leading-5 text-neutral-400",
        children: "기존 기록의 분류\xb7날짜\xb7내용을 유지하고 갤러리 분류만 적용합니다. 원본 수정은 아카이브 관리에서 할 수 있어요."
      }), jsxRuntime.jsxs("label", {
        className: "block text-xs text-neutral-400",
        children: ["갤러리 분류", jsxRuntime.jsx("select", {
          value: o.galleryClassification,
          onChange: t => f("galleryClassification", t.target.value),
          className: inputClass,
          children: galleryClassifications.map(t => jsxRuntime.jsx("option", {
            value: t.key,
            children: t.label
          }, t.key))
        })]
      }), jsxRuntime.jsxs("label", {
        className: "block text-xs text-neutral-400",
        children: ["날짜", jsxRuntime.jsx("input", {
          readOnly: !!o.archiveId,
          required: !0,
          type: "date",
          value: o.date,
          onChange: t => f("date", t.target.value),
          className: "".concat(inputClass, " [color-scheme:dark]")
        })]
      }), jsxRuntime.jsxs("label", {
        className: "block text-xs text-neutral-400",
        children: ["제목 / 게시물 내용", jsxRuntime.jsx("textarea", {
          readOnly: !!o.archiveId,
          required: !0,
          rows: 3,
          value: o.title,
          onChange: t => f("title", t.target.value),
          className: inputClass
        })]
      }), jsxRuntime.jsxs("label", {
        className: "block text-xs text-neutral-400",
        children: ["사진 / 영상 미리보기 이미지 주소", jsxRuntime.jsx("input", {
          readOnly: !!o.archiveId,
          required: !0,
          type: "url",
          value: o.thumbnailUrl,
          onChange: t => {
            f("thumbnailUrl", t.target.value), n([]);
          },
          className: inputClass,
          placeholder: "https://…jpg"
        })]
      }), (m.length > 0 || o.thumbnailUrl) && jsxRuntime.jsx("div", {
        className: "grid grid-cols-2 gap-2",
        children: (m.length ? m : [{
          url: o.thumbnailUrl,
          type: "image"
        }]).map((t, e) => jsxRuntime.jsxs("div", {
          className: "relative overflow-hidden rounded-lg bg-black",
          children: [jsxRuntime.jsx("img", {
            src: "video" === t.type ? t.poster || t.thumbnailUrl || o.thumbnailUrl : t.url,
            alt: "등록할 미디어 미리보기",
            referrerPolicy: "no-referrer",
            className: "aspect-square w-full object-cover"
          }), "video" === t.type && jsxRuntime.jsx("span", {
            className: "absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs",
            children: "영상"
          })]
        }, "".concat(t.url, "-").concat(e)))
      })]
    }), p && jsxRuntime.jsx("p", {
      role: "alert",
      className: "mt-3 text-xs leading-5 text-red-300",
      children: p
    }), jsxRuntime.jsxs("div", {
      className: "mt-4 flex gap-2",
      children: [jsxRuntime.jsx("button", {
        disabled: c,
        className: "flex-1 rounded-xl bg-accent py-3 text-sm font-bold disabled:opacity-40",
        children: c ? "처리 중…" : "게시물 등록"
      }), jsxRuntime.jsx("button", {
        type: "button",
        disabled: c,
        onClick: l,
        className: "rounded-xl border border-white/15 px-4 py-3 text-sm disabled:opacity-40",
        children: "취소"
      })]
    })]
  });
}

let previewPostsKey = "hq-gallery-preview-posts";

let previewOverridesKey = "hq-gallery-preview-overrides";

let readStorage = (t, e) => {
  try {
    return JSON.parse(sessionStorage.getItem(t) || "null") || e;
  } catch (t) {
    return e;
  }
};

function previewRecordsWithEdits(t) {
  let e = readStorage(previewOverridesKey, {});
  return [...t, ...readStorage(previewPostsKey, [])].map(t => ({
    ...t,
    ...e[String(t.id)]
  })).filter(t => !t.previewDeleted);
}

function addPreviewPost(t) {
  let e = {
    ...t,
    id: "preview-".concat(crypto.randomUUID())
  };
  return sessionStorage.setItem(previewPostsKey, JSON.stringify([...readStorage(previewPostsKey, []), e])), notifyArchiveChange(), e;
}

function classifyPreviewRecords(t, e, a) {
  let i = arguments.length > 3 && void 0 !== arguments[3] && arguments[3],
    s = function (t, e, a) {
      if (!galleryClassifications.some(t => t.key === a)) throw Error("적용할 분류를 선택해주세요.");
      let i = [...new Set(e.map(String))];
      if (!i.length) throw Error("분류할 게시물을 선택해주세요.");
      let s = new Map(t.map(t => [String(t.id), t]));
      return i.map(t => {
        let e = s.get(t);
        if (!e) throw Error("선택한 게시물을 찾지 못했어요. 새로고침 후 다시 선택해주세요.");
        let i = applyGalleryClassification(e.keywords || [], a);
        return {
          ...e,
          keywords: i,
          rawKeywords: i.join(", ")
        };
      });
    }(previewRecordsWithEdits(t), e, a),
    l = readStorage(previewOverridesKey, {});
  return s.forEach(t => {
    i && (t.keywords = [...new Set([...t.keywords, "갤러리:직접등록"])], t.rawKeywords = t.keywords.join(", ")), l[String(t.id)] = t;
  }), sessionStorage.setItem(previewOverridesKey, JSON.stringify(l)), notifyArchiveChange(), {
    updatedIds: s.map(t => String(t.id)),
    failedIds: []
  };
}

let buttonClass = "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm disabled:opacity-40";

function GalleryLightbox(t) {
  var e;
  let {
      photos: a,
      selectedKey: o,
      onSelect: r,
      onClose: m,
      hiddenKeys
    } = t,
    n = React.useRef(null),
    c = a.findIndex(t => t.key === o),
    selected = a[c],
    p = React.useRef(null);
  const [detail, setDetail] = React.useState(null);
  const [mediaIndex, setMediaIndex] = React.useState(0);
  React.useEffect(() => {
    setMediaIndex(0);
    if (!selected?.deferred) return;
    const controller = new AbortController();
    resolveGalleryMedia([selected], controller.signal).then(([record]) => {
      if (controller.signal.aborted) return;
      const media = record.media.filter(item => !hiddenKeys?.has(galleryImageKey(item.url)));
      setDetail({ key: selected.key, media });
    }).catch(() => {
      if (!controller.signal.aborted) setDetail({ key: selected.key, media: [] });
    });
    return () => controller.abort();
  }, [selected, hiddenKeys]);
  const resolved = detail?.key === selected?.key ? detail : null;
  const original = resolved?.media[mediaIndex];
  const d = original ? { ...selected, ...original, isVideo: original.type === "video" } : selected;
  const pending = selected?.deferred && !resolved;
  if (React.useEffect(() => {
    var t;
    let e = document.activeElement,
      a = document.body.style.overflow;
    return document.body.style.overflow = "hidden", null === (t = n.current) || void 0 === t || t.focus(), () => {
      document.body.style.overflow = a, null == e || e.focus();
    };
  }, []), !d) return null;
  let g = t => {
    a[c + t] && r(a[c + t].key);
  };
  return ReactDOM.createPortal(jsxRuntime.jsxs("div", {
    ref: n,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "투샷 크게 보기",
    tabIndex: -1,
    className: "fixed inset-0 z-[100] flex flex-col bg-black/95 p-4 text-white outline-none",
    onKeyDown: t => {
      if ("Escape" === t.key && m(), "ArrowLeft" === t.key && g(-1), "ArrowRight" === t.key && g(1), "Tab" === t.key) {
        let e = [...n.current.querySelectorAll("button:not(:disabled), a[href]")],
          a = e[0],
          i = e[e.length - 1];
        t.shiftKey && (document.activeElement === a || document.activeElement === n.current) ? (t.preventDefault(), null == i || i.focus()) : t.shiftKey || document.activeElement !== i && document.activeElement !== n.current || (t.preventDefault(), null == a || a.focus());
      }
    },
    children: [jsxRuntime.jsxs("div", {
      className: "mx-auto flex w-full max-w-3xl items-center justify-between gap-4",
      children: [resolved?.media.length > 1 && jsxRuntime.jsx("div", {
        className: "flex flex-wrap gap-2",
        "aria-label": "게시물의 미디어",
        children: resolved.media.map((item, index) => jsxRuntime.jsx("button", {
          type: "button",
          className: buttonClass,
          "aria-pressed": mediaIndex === index,
          onClick: () => setMediaIndex(index),
          children: `${index + 1} / ${resolved.media.length}`
        }, index))
      }), jsxRuntime.jsx("p", {
        className: "text-sm text-neutral-300",
        children: (null === (e = d.date) || void 0 === e ? void 0 : e.replace(/-/g, ".")) || "날짜 미등록"
      }), jsxRuntime.jsx("button", {
        onClick: m,
        "aria-label": "사진 닫기",
        className: buttonClass,
        children: jsxRuntime.jsx(CloseIcon, {
          size: 20
        })
      })]
    }), jsxRuntime.jsxs("div", {
      className: "relative flex min-h-0 flex-1 items-center justify-center py-4",
      onTouchStart: t => {
        p.current = t.touches[0].clientX;
      },
      onTouchEnd: t => {
        if (null !== p.current) {
          let e = t.changedTouches[0].clientX - p.current;
          Math.abs(e) > 50 && g(e < 0 ? 1 : -1);
        }
        p.current = null;
      },
      children: [pending || (selected.deferred && !original) ? jsxRuntime.jsxs("div", {
        className: "flex max-h-full flex-col items-center gap-3",
        children: [d.thumbnailUrl && jsxRuntime.jsx("img", {
          src: d.thumbnailUrl,
          alt: d.title || "미리보기",
          referrerPolicy: "no-referrer",
          className: "max-h-[55dvh] max-w-full object-contain"
        }), jsxRuntime.jsx("p", {
          role: "status",
          className: "text-sm text-neutral-400",
          children: pending ? "원본 불러오는 중…" : "원본 미디어를 불러오지 못했어요."
        }), jsxRuntime.jsx("a", {
          href: safeUrl(d.link),
          target: "_blank",
          rel: "noopener noreferrer",
          className: buttonClass,
          children: "원본 게시물 보기"
        })]
      }) : d.isVideo ? d.external ? jsxRuntime.jsxs("div", {
        className: "flex max-h-full flex-col items-center gap-4",
        children: [jsxRuntime.jsx("img", {
          src: d.poster || d.thumbnailUrl,
          alt: d.title || "영상 미리보기",
          className: "max-h-[55dvh] max-w-full object-contain"
        }), jsxRuntime.jsx("a", {
          href: d.link,
          target: "_blank",
          rel: "noopener noreferrer",
          className: buttonClass,
          children: "원본에서 영상 재생"
        })]
      }) : jsxRuntime.jsx("video", {
        src: d.url,
        poster: d.poster || d.thumbnailUrl,
        controls: !0,
        playsInline: !0,
        preload: "metadata",
        className: "max-h-full max-w-full object-contain"
      }, d.url) : jsxRuntime.jsx("img", {
        src: d.url,
        alt: d.title || "혚쾌 투샷",
        referrerPolicy: "no-referrer",
        className: "max-h-full max-w-full object-contain"
      }, d.url), jsxRuntime.jsx("button", {
        disabled: 0 === c,
        onClick: () => g(-1),
        "aria-label": "이전 사진",
        className: "absolute left-0 bg-black/70 ".concat(buttonClass),
        children: jsxRuntime.jsx(PreviousIcon, {})
      }), jsxRuntime.jsx("button", {
        disabled: c === a.length - 1,
        onClick: () => g(1),
        "aria-label": "다음 사진",
        className: "absolute right-0 bg-black/70 ".concat(buttonClass),
        children: jsxRuntime.jsx(NextIcon, {})
      })]
    }), jsxRuntime.jsxs("div", {
      className: "mx-auto w-full max-w-3xl pb-4 text-sm",
      children: [jsxRuntime.jsx("p", {
        className: "line-clamp-2",
        children: d.title
      }), d.link && jsxRuntime.jsx("a", {
        href: d.link,
        target: "_blank",
        rel: "noopener noreferrer",
        className: "mt-3 inline-block text-neutral-300 underline",
        children: "원본 게시물 보기"
      })]
    })]
  }), document.body);
}

let previewHiddenKey = "hq-gallery-preview-hidden";

const duplicateImageKeys = new Map(duplicateGroups.flatMap(group => {
  const keys = group.map(galleryImageKey).filter(Boolean);
  return keys.map(key => [key, keys[0]]);
}));

function compareGalleryDate(left, right, order) {
  if (!left.date !== !right.date) return left.date ? -1 : 1;
  return (order === "asc" ? 1 : -1)
    * (left.date.localeCompare(right.date) || Number(left.id) - Number(right.id));
}

function galleryCards(records, order) {
  const seen = new Set();
  return [...records].sort((left, right) => compareGalleryDate(left, right, order)).flatMap(record => {
    const media = record.media || (record.images || []).map(url => ({ url, type: "image" }));
    return media.flatMap(item => {
      const key = galleryImageKey(item.url);
      const identity = item.type === "image" ? duplicateImageKeys.get(key) || key : key;
      if (!key || seen.has(identity)) return [];
      seen.add(identity);
      return [{ ...record, ...item, key, isVideo: item.type === "video" }];
    });
  });
}

function matchesGalleryFilters(card, date, type, category) {
  if (date && !card.date.startsWith(date)) return false;
  if (type !== "all" && (type === "video") !== card.isVideo) return false;
  if (category === "전체") return true;
  const main = card.isVideo ? "video" : "image";
  const manual = galleryClassifications.find(item => item.main === main && (card.keywords || []).includes(item.keyword));
  if (manual) return manual.sub === category;
  const inferred = card.isVideo
    ? (/쇼츠|숏츠|shorts/i.test(`${card.subCategory || ""} ${card.title || ""}`) ? "쇼츠" : "커플릴스")
    : (/셀카(?!봉)|거셀/.test(`${card.title || ""} ${(card.keywords || []).join(" ")}`) ? "셀카" : "투샷");
  return inferred === category;
}

function galleryTileSource(card) {
  const source = card.isVideo || card.deferred ? card.poster || card.thumbnailUrl : card.url;
  const safeSource = safeUrl(source);
  if (!safeSource) return undefined;
  const url = new URL(safeSource);
  if (url.hostname === "pbs.twimg.com" && url.pathname.startsWith("/media/")) {
    url.searchParams.set("name", "small");
  }
  return url.href;
}

function galleryPreview(record) {
  const cached = snapshotById.get(String(record.id));
  if (cached?.link === record.link && cached.thumbnailUrl === record.thumbnailUrl && cached.media?.length) {
    return { ...record, media: cached.media };
  }
  const directVideo = /\.(mp4|webm)(?:$|\?)/i.test(record.link);
  const video = directVideo || /video|youtube|youtu\.be|instagram.*\/reel|\/shorts\//i.test(record.thumbnailUrl + record.link)
    || /^(릴스|쇼츠|숏츠|틱톡)$/.test(record.subCategory);
  const url = directVideo ? record.link : record.thumbnailUrl || record.link;
  const deferred = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\//i.test(record.link);
  const media = galleryImageKey(url) && (video || record.thumbnailUrl || deferred) ? [{
    url,
    poster: record.thumbnailUrl,
    type: video ? "video" : "image",
    external: video && !directVideo,
    deferred
  }] : [];
  return { ...record, media };
}

async function loadGalleryPage({ previous, limit, date, order, type, category, signal }) {
  const firstPage = previous ? null : readGalleryRecords({ date, order, signal, publicGallery: true, limit: GALLERY_METADATA_BATCH_SIZE });
  const [hidden, initial] = await Promise.all([
    previous?.hidden || galleryService.hiddenKeys().then(keys => new Set(keys)), firstPage
  ]);
  const records = [...(previous?.records || [])];
  let cursor = previous?.cursor;
  let pendingPage = initial;
  let count = galleryCards(records, order).filter(card =>
    !hidden.has(card.key) && matchesGalleryFilters(card, date, type, category)).length;
  while (count < limit && cursor !== null) {
    signal.throwIfAborted();
    const page = pendingPage || await readGalleryRecords({
      cursor, date, order, signal, publicGallery: true, limit: GALLERY_METADATA_BATCH_SIZE
    });
    pendingPage = null;
    records.push(...page.records.map(galleryPreview));
    cursor = page.nextCursor;
    count = galleryCards(records, order).filter(card =>
      !hidden.has(card.key) && matchesGalleryFilters(card, date, type, category)).length;
  }
  return { records, hidden, cursor };
}

let warmedGallery = null;
const GALLERY_WARMUP_TTL = 30_000;

function warmGallery() {
  if (warmedGallery && Date.now() - warmedGallery.startedAt < GALLERY_WARMUP_TTL) return;
  const entry = { startedAt: Date.now() };
  entry.page = loadGalleryPage({
    previous: null, limit: GALLERY_PAGE_SIZE, date: "", order: "desc",
    type: "all", category: "전체", signal: AbortSignal.timeout(GALLERY_WARMUP_TTL)
  }).then(page => {
    if (warmedGallery === entry) {
      const cards = galleryCards(page.records, "desc").filter(card => !page.hidden.has(card.key));
      for (const card of cards.slice(0, 6)) {
        const src = galleryTileSource(card);
        if (!src) continue;
        const thumbnail = new Image();
        thumbnail.referrerPolicy = "no-referrer";
        thumbnail.fetchPriority = "low";
        thumbnail.src = src;
      }
    }
    return page;
  }).catch(() => {
    if (warmedGallery === entry) warmedGallery = null;
    return null;
  });
  warmedGallery = entry;
}

function GalleryView(t) {
  let {
      previewRecords: e = null,
      management: a = !1,
      onBack: o,
      onEdit: r,
      refreshKey: m = 0
    } = t,
    n = null !== e,
    c = React.useMemo(() => e ? {
      list: async () => previewRecordsWithEdits(e).filter(isGalleryRecord).map(t => ({
        ...t,
        media: t.media || (t.images || (t.thumbnailUrl ? [t.thumbnailUrl] : [])).map(t => ({
          url: t,
          type: "image"
        }))
      })),
      lookup: async t => {
        let a = previewRecordsWithEdits(e).find(e => galleryPostLinkKey(e.link) === galleryPostLinkKey(t));
        return a ? {
          ...a,
          archiveId: a.id
        } : galleryService.lookup(t);
      },
      bulkClassification: async (t, a) => classifyPreviewRecords(e, t, a),
      create: async t => {
        let a = previewRecordsWithEdits(e).find(e => galleryPostLinkKey(e.link) === galleryPostLinkKey(t.link));
        if (a && String(t.archiveId || "") === String(a.id)) return makeGalleryPost({
          ...t,
          ...a
        }), classifyPreviewRecords(e, [a.id], t.galleryClassification, !0), previewRecordsWithEdits(e).find(t => t.id === a.id);
        let i = makeGalleryPost(t);
        if (previewRecordsWithEdits(e).some(t => galleryPostLinkKey(t.link) === galleryPostLinkKey(i.link))) throw Error("이미 등록된 게시물이에요.");
        return addPreviewPost({
          ...i,
          media: t.media
        });
      },
      hiddenKeys: async () => {
        try {
          return JSON.parse(sessionStorage.getItem(previewHiddenKey) || "[]");
        } catch (t) {
          return [];
        }
      },
      setHidden: async (t, e) => {
        let a = new Set(JSON.parse(sessionStorage.getItem(previewHiddenKey) || "[]"));
        e ? a.add(t) : a.delete(t), sessionStorage.setItem(previewHiddenKey, JSON.stringify([...a]));
      }
    } : galleryService, [e]),
    [d, p] = React.useState(""),
    [g, u] = React.useState("desc"),
    [h, b] = React.useState("gallery"),
    [x, w] = React.useState([]),
    [y, j] = React.useState(new Set()),
    [f, v] = React.useState(!0),
    [k, A] = React.useState(""),
    [N, _] = React.useState(0),
    [C, U] = React.useState(!1),
    [G, E] = React.useState(""),
    [I, P] = React.useState(null),
    [T, H] = React.useState(48),
    [z, M] = React.useState("all"),
    [Y, Q] = React.useState("전체"),
    [L, K] = React.useState(""),
    W = React.useRef(null),
    X = React.useRef(null),
    [$, tt] = React.useState(!1),
    [ti, ts] = React.useState(!1),
    [tl, to] = React.useState(""),
    [tr, tc] = React.useState(!1),
    [td, tu] = React.useState(new Set()),
    [th, tb] = React.useState(""),
    [tw, tA] = React.useState(!1),
    [tN, t_] = React.useState("");
  const paginated = !a && !n;
  const [publicPage, setPublicPage] = React.useState(null);
  const pageRequest = React.useRef(null);
  const pageKey = JSON.stringify([d, g, z, Y, N, m]);
  const fetchPage = React.useCallback(async (previous, limit) => {
    if (pageRequest.current) return;
    const request = new AbortController();
    pageRequest.current = request;
    v(true);
    A("");
    try {
      const canUseWarmup = !previous && !d && g === "desc" && z === "all" && Y === "전체";
      const warmup = canUseWarmup && warmedGallery && Date.now() - warmedGallery.startedAt < GALLERY_WARMUP_TTL
        ? warmedGallery.page : null;
      const prepared = warmup ? await warmup : null;
      request.signal.throwIfAborted();
      const page = prepared || await loadGalleryPage({
        previous, limit, date: d, order: g, type: z, category: Y, signal: request.signal
      });
      if (request.signal.aborted) return;
      setPublicPage({ ...page, key: pageKey });
      w(page.records);
      j(page.hidden);
      H(limit);
    } catch {
      if (!request.signal.aborted) A("갤러리를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (pageRequest.current === request) {
        pageRequest.current = null;
        v(false);
      }
    }
  }, [d, g, z, Y, pageKey]);
  React.useEffect(() => {
    if (!paginated) return;
    w([]);
    j(new Set());
    setPublicPage(null);
    H(GALLERY_PAGE_SIZE);
    fetchPage(null, GALLERY_PAGE_SIZE);
    return () => {
      pageRequest.current?.abort();
      pageRequest.current = null;
    };
  }, [paginated, fetchPage]);
  React.useEffect(() => {
    let t = () => {
      galleryService.invalidate(), _(t => t + 1);
    };
    return window.addEventListener(archiveChangeEvent, t), () => window.removeEventListener(archiveChangeEvent, t);
  }, []), React.useEffect(() => {
    var t;
    if (a) return;
    let e = null === (t = W.current) || void 0 === t ? void 0 : t.closest("[data-archive-scroll]");
    if (!e) return;
    X.current = e;
    let i = () => tt(e.scrollTop > 300);
    return e.addEventListener("scroll", i, {
      passive: !0
    }), i(), () => e.removeEventListener("scroll", i);
  }, [a]), React.useEffect(() => {
    if (paginated) return;
    let t = !0;
    return v(!0), A(""), Promise.all([c.list({
      refresh: N > 0
    }), c.hiddenKeys()]).then(e => {
      let [a, i] = e;
      t && (w(a), j(new Set(i)));
    }).catch(() => {
      t && A("갤러리를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }).finally(() => {
      t && v(!1);
    }), () => {
      t = !1;
    };
  }, [c, N, m, paginated]), React.useEffect(() => {
    if (!paginated) H(48);
    P(null);
  }, [d, g, z, Y, C, paginated]), React.useEffect(() => {
    tu(new Set());
  }, [d, g, z, Y, C]);
  const tC = React.useMemo(() => galleryCards(x, paginated ? g : "asc"), [x, paginated, g]);
  const tS = React.useMemo(() => tC.filter(card => a && C ? y.has(card.key) : !y.has(card.key)), [tC, y, a, C]);
  const tF = React.useMemo(() => {
    const counts = new Map();
    for (const card of tS) if (card.date) counts.set(card.date, (counts.get(card.date) || 0) + 1);
    return counts;
  }, [tS]);
  const tU = React.useMemo(() => tS.filter(card => matchesGalleryFilters(card, d, z, Y))
    .sort((left, right) => compareGalleryDate(left, right, g)), [tS, d, g, z, Y]);
  const firstScreenKeys = new Set(tU.slice(0, 6).map(card => card.key));
  let tG = React.useMemo(() => {
      let t = tU.slice(0, T);
      if ("gallery" === h) return t.length ? [["gallery", t]] : [];
      let e = new Map();
      return t.forEach(t => {
        let a = t.date || "";
        e.has(a) || e.set(a, []), e.get(a).push(t);
      }), [...e];
    }, [tU, T, h]),
    tE = t => {
      tw || tu(e => {
        let a = new Set(e),
          i = String(t);
        return a.has(i) ? a.delete(i) : a.add(i), a;
      });
    },
    tI = async () => {
      if (tw || !td.size || !th) return;
      let t = galleryClassifications.find(t => t.key === th);
      if ([...td].some(e => !tC.some(a => String(a.id) === e && a.isVideo === ("video" === t.main)))) {
        to("사진 분류는 사진이 있는 게시물에, 영상 분류는 영상이 있는 게시물에 적용해주세요.");
        return;
      }
      tA(!0), to("");
      try {
        let t = await c.bulkClassification([...td], th);
        tu(new Set(t.failedIds)), to(t.failedIds.length ? "일부 게시물은 반영하지 못했어요. 선택된 항목을 확인하고 다시 적용해주세요." : "선택한 게시물에 분류를 적용했어요. 아카이브 관리에도 함께 반영됩니다."), _(t => t + 1);
      } catch (t) {
        to(t.message || "분류를 저장하지 못했어요. 다시 적용해주세요.");
      } finally {
        tA(!1);
      }
    },
    tP = async t => {
      if (G) return;
      let e = !y.has(t.key);
      E(t.key), A("");
      try {
        await c.setHidden(t.key, e), j(a => {
          let i = new Set(a);
          return e ? i.add(t.key) : i.delete(t.key), i;
        });
      } catch (t) {
        A(t.message || "숨김 설정을 저장하지 못했어요.");
      } finally {
        E("");
      }
    },
    tT = async t => {
      if (a && tr) {
        let e = tU.find(e => e.key === t);
        e && tE(e.id);
        return;
      }
      if (a && r) {
        let e = tU.find(e => e.key === t);
        if (!e || L) return;
        K(t), A("");
        try {
          await r(e);
        } catch (t) {
          A(t.message || "편집창을 열지 못했어요.");
        } finally {
          K("");
        }
        return;
      }
      P(t);
      let e = tU.find(e => e.key === t);
      e && !n && analyticsService.track({
        eventType: "content",
        tabKey: "gallery",
        contentType: "hq_archive",
        contentId: e.id,
        contentTitle: e.title,
        contentUrl: e.link
      });
    };
  return jsxRuntime.jsxs("div", {
    ref: W,
    className: a ? "pt-4 text-white" : "px-4 pt-6 text-white",
    children: [a && jsxRuntime.jsx("button", {
      disabled: tw,
      onClick: o,
      className: "mb-4 text-xs text-neutral-400",
      children: "← 관리자 메뉴"
    }), n && jsxRuntime.jsxs("p", {
      className: "mb-4 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs leading-5 text-neutral-400",
      children: ["미리보기 \xb7 실제 아카이브 기록", a ? " \xb7 변경은 이 미리보기에만 적용됩니다." : ""]
    }), n && a && jsxRuntime.jsxs("div", {
      className: "mb-4",
      children: [jsxRuntime.jsx("button", {
        className: buttonClass,
        onClick: () => t_(JSON.stringify({
          overrides: JSON.parse(sessionStorage.getItem("hq-gallery-preview-overrides") || "{}"),
          hiddenKeys: JSON.parse(sessionStorage.getItem(previewHiddenKey) || "[]")
        }, null, 2)),
        children: "미리보기 설정 확인"
      }), tN && jsxRuntime.jsx("a", {
        className: "ml-3 text-xs underline",
        href: "data:application/json;charset=utf-8,".concat(encodeURIComponent(tN)),
        download: "gallery-preview-settings.json",
        children: "설정 파일 저장"
      }), tN && jsxRuntime.jsxs("label", {
        className: "mt-3 block text-xs",
        children: ["운영 반영용 미리보기 설정", jsxRuntime.jsx("textarea", {
          readOnly: !0,
          value: tN,
          className: "mt-2 h-48 w-full rounded-xl bg-neutral-900 p-3"
        })]
      })]
    }), a && !ti && jsxRuntime.jsxs("button", {
      onClick: () => {
        ts(!0), to("");
      },
      className: "mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold",
      children: [jsxRuntime.jsx(AddIcon, {
        size: 17
      }), "게시물 추가"]
    }), a && ti && jsxRuntime.jsx(GalleryPostForm, {
      source: c,
      onCancel: () => ts(!1),
      onCreated: t => {
        w(e => [...e.filter(e => e.id !== t.id), t]), p(t.date), M("all"), Q("전체"), U(!1), ts(!1), to("게시물을 등록했어요.");
      }
    }), tl && jsxRuntime.jsx("p", {
      role: "status",
      className: "mb-4 rounded-xl border border-white/10 p-3 text-xs text-neutral-300",
      children: tl
    }), !a && jsxRuntime.jsxs("div", {
      className: "mb-5 flex items-center gap-2",
      children: [jsxRuntime.jsx(GalleryIcon, {
        size: 22,
        className: "text-accent"
      }), jsxRuntime.jsx("h2", {
        className: "text-xl font-black",
        children: "갤러리"
      })]
    }), jsxRuntime.jsx(GalleryDatePicker, {
      value: d,
      onChange: p,
      counts: tF,
      partialCounts: paginated
    }), jsxRuntime.jsx("div", {
      role: "group",
      "aria-label": "갤러리 보기 방식",
      className: "mt-4 inline-flex rounded-xl border border-white/10 bg-neutral-950 p-1",
      children: [["date", "날짜"], ["gallery", "갤러리"]].map(t => {
        let [e, a] = t;
        return jsxRuntime.jsx("button", {
          "aria-pressed": h === e,
          onClick: () => b(e),
          className: "rounded-lg px-4 py-2 text-sm font-bold ".concat(h === e ? "bg-neutral-800 text-white" : "text-neutral-500"),
          children: a
        }, e);
      })
    }), jsxRuntime.jsx("div", {
      className: "mt-4 flex gap-2",
      children: [["all", "전체"], ["image", "사진"], ["video", "영상"]].map(t => {
        let [e, a] = t;
        return jsxRuntime.jsx("button", {
          onClick: () => {
            M(e), Q("전체");
          },
          "aria-pressed": z === e,
          className: "rounded-full border px-3 py-1.5 text-xs font-bold ".concat(z === e ? "border-white/30 bg-neutral-800 text-white" : "border-white/10 bg-neutral-900 text-neutral-500"),
          children: a
        }, e);
      })
    }), "all" !== z && jsxRuntime.jsx("div", {
      className: "mt-3 flex gap-2",
      children: ["전체", ...("image" === z ? ["셀카", "투샷"] : ["커플릴스", "쇼츠"])].map(t => jsxRuntime.jsx("button", {
        onClick: () => Q(t),
        "aria-pressed": Y === t,
        className: "rounded-lg border px-3 py-1.5 text-xs ".concat(Y === t ? "border-accent/50 bg-accent/10 text-white" : "border-white/10 text-neutral-500"),
        children: t
      }, t))
    }), a && jsxRuntime.jsxs("div", {
      className: "mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-6 text-neutral-400",
      children: [jsxRuntime.jsx("p", {
        children: "숨겨도 원본 아카이브 기록은 유지됩니다."
      }), jsxRuntime.jsxs("label", {
        className: "mt-2 flex items-center gap-2",
        children: [jsxRuntime.jsx("input", {
          type: "checkbox",
          checked: C,
          onChange: t => U(t.target.checked)
        }), "숨긴 항목만 보기 \xb7 복구"]
      })]
    }), a && jsxRuntime.jsxs("div", {
      className: "my-4 rounded-xl border border-white/15 bg-neutral-900 p-3",
      children: [jsxRuntime.jsx("button", {
        disabled: tw,
        "aria-pressed": tr,
        onClick: () => {
          tc(t => !t), tu(new Set()), to("");
        },
        className: buttonClass,
        children: tr ? "선택 끝내기" : "여러 게시물 분류"
      }), tr && jsxRuntime.jsxs("div", {
        className: "mt-3 space-y-3",
        children: [jsxRuntime.jsx("p", {
          className: "text-xs leading-5 text-neutral-400",
          children: "사진이나 영상을 눌러 게시물을 선택하세요. 같은 게시물의 미디어는 함께 선택됩니다."
        }), jsxRuntime.jsxs("div", {
          className: "flex flex-wrap gap-2",
          children: [jsxRuntime.jsx("button", {
            disabled: tw || f,
            onClick: () => tu(new Set(tU.slice(0, T).map(t => String(t.id)))),
            className: buttonClass,
            children: "현재 화면 전체 선택"
          }), jsxRuntime.jsx("button", {
            disabled: tw || !td.size,
            onClick: () => tu(new Set()),
            className: buttonClass,
            children: "선택 해제"
          })]
        }), jsxRuntime.jsxs("label", {
          className: "block text-xs text-neutral-300",
          children: ["일괄 적용할 분류", jsxRuntime.jsxs("select", {
            disabled: tw,
            value: th,
            onChange: t => tb(t.target.value),
            className: "mt-2 w-full rounded-xl border border-white/15 bg-neutral-950 p-3 text-sm text-white",
            children: [jsxRuntime.jsx("option", {
              value: "",
              children: "분류 선택"
            }), galleryClassifications.map(t => jsxRuntime.jsx("option", {
              value: t.key,
              children: t.label
            }, t.key))]
          })]
        }), jsxRuntime.jsx("button", {
          disabled: tw || f || !td.size || !th,
          onClick: tI,
          className: "w-full rounded-xl bg-accent py-3 text-sm font-bold disabled:opacity-40",
          children: tw ? "분류 적용 중…" : "선택한 게시물에 적용"
        })]
      })]
    }), jsxRuntime.jsx(SectionLabel, {
      label: d ? d.replace(/-/g, ".") : "전체",
      showCount: !1,
      sortOrder: g,
      onSort: () => u(t => "desc" === t ? "asc" : "desc")
    }), k && jsxRuntime.jsxs("div", {
      role: "alert",
      className: "my-4 rounded-xl border border-red-900 p-3 text-sm text-red-300",
      children: [jsxRuntime.jsx("p", {
        children: k
      }), jsxRuntime.jsx("button", {
        className: "mt-2 ".concat(buttonClass),
        onClick: () => paginated ? fetchPage(publicPage, publicPage ? T + GALLERY_PAGE_SIZE : GALLERY_PAGE_SIZE) : _(t => t + 1),
        children: "다시 불러오기"
      })]
    }), tG.map(t => {
      let [e, s] = t;
      return jsxRuntime.jsxs("section", {
        "aria-label": "gallery" === h ? "미디어 갤러리" : e || "날짜 미등록",
        className: "mb-7",
        children: ["date" === h && jsxRuntime.jsx("h3", {
          className: "mb-3 text-sm font-bold",
          children: jsxRuntime.jsx("time", {
            dateTime: e || void 0,
            children: e ? e.replace(/-/g, ".") : "날짜 미등록"
          })
        }), jsxRuntime.jsx("div", {
          className: "gallery" === h ? "grid grid-cols-3 gap-px lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 lg:gap-2" : "grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:gap-3",
          children: s.map(t => jsxRuntime.jsxs("article", {
            className: "min-w-0 overflow-hidden bg-neutral-900 ".concat("date" === h ? "rounded-xl border border-white/10" : ""),
            children: [jsxRuntime.jsxs("button", {
              disabled: !!L || tw,
              onClick: () => tT(t.key),
              "aria-pressed": a && tr ? td.has(String(t.id)) : void 0,
              "aria-label": "".concat(t.date || "", " ").concat(t.title || "투샷", " ").concat(a ? tr ? "게시물 선택" : "기록 수정" : t.isVideo ? "영상 보기" : "크게 보기"),
              className: "relative block aspect-square w-full overflow-hidden text-sm text-neutral-500 disabled:opacity-50",
              children: [jsxRuntime.jsx("span", {
                "aria-hidden": "true",
                className: "absolute inset-0 flex items-center justify-center p-4",
                children: "미리보기를 불러올 수 없어요"
              }), galleryTileSource(t) && jsxRuntime.jsx("img", {
                src: galleryTileSource(t),
                alt: t.title || "혚쾌 투샷",
                loading: paginated && firstScreenKeys.has(t.key) ? "eager" : "lazy",
                fetchPriority: paginated && firstScreenKeys.has(t.key) ? "high" : undefined,
                referrerPolicy: "no-referrer",
                className: "relative h-full w-full bg-neutral-900 object-cover",
                onError: t => {
                  t.currentTarget.style.opacity = "0";
                }
              }), t.isVideo && jsxRuntime.jsxs(jsxRuntime.Fragment, {
                children: [jsxRuntime.jsx("span", {
                  className: "absolute inset-0 flex items-center justify-center bg-black/10",
                  children: jsxRuntime.jsx("span", {
                    className: "flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white",
                    children: jsxRuntime.jsx(PlayIcon, {
                      size: 19,
                      fill: "currentColor"
                    })
                  })
                }), jsxRuntime.jsx("span", {
                  className: "absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white",
                  children: "영상"
                })]
              }), a && tr && jsxRuntime.jsx("span", {
                "aria-hidden": "true",
                className: "absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-white ".concat(td.has(String(t.id)) ? "border-accent bg-accent" : "border-white bg-black/70"),
                children: td.has(String(t.id)) ? "✓" : ""
              })]
            }), a && !tr && jsxRuntime.jsx("button", {
              disabled: !!G,
              className: "w-full border-t border-white/10 py-3 text-xs text-neutral-200 disabled:opacity-40",
              onClick: () => tP(t),
              children: G === t.key ? "저장 중…" : y.has(t.key) ? "갤러리에 복구" : "갤러리에서 숨기기"
            })]
          }, t.key))
        })]
      }, e || "undated");
    }), f && jsxRuntime.jsx("p", {
      role: "status",
      className: "py-8 text-center text-sm text-neutral-400",
      children: "사진과 영상을 모으고 있어요…"
    }), !f && !k && !tU.length && jsxRuntime.jsx("p", {
      className: "py-12 text-center text-sm text-neutral-400",
      children: a && C ? "숨긴 항목이 없어요." : "이 날짜에는 표시할 기록이 없어요."
    }), (paginated ? publicPage?.key === pageKey && (publicPage.cursor || tU.length > T) : tU.length > T) && jsxRuntime.jsx("button", {
      disabled: f,
      onClick: () => paginated ? fetchPage(publicPage, T + GALLERY_PAGE_SIZE) : H(t => t + 48),
      className: "my-4 w-full ".concat(buttonClass),
      children: f ? "불러오는 중…" : "더보기"
    }), I && jsxRuntime.jsx(GalleryLightbox, {
      photos: paginated ? tU.slice(0, T) : tU,
      selectedKey: I,
      hiddenKeys: y,
      onSelect: tT,
      onClose: () => P(null)
    }), !a && $ && ReactDOM.createPortal(jsxRuntime.jsx("button", {
      onClick: () => {
        var t;
        return null === (t = X.current) || void 0 === t ? void 0 : t.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      },
      "aria-label": "갤러리 맨 위로 이동",
      className: "fixed bottom-24 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-neutral-900/95 text-white shadow-xl md:right-[calc((100vw-28rem)/2+1rem)]",
      children: jsxRuntime.jsx(UpIcon, {
        size: 22
      })
    }), document.body)]
  });
}

export { GalleryView, galleryService, galleryClassifications, applyGalleryClassification, warmGallery };
