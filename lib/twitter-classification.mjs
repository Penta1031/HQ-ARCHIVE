const text = value => String(value ?? "").trim();
const twitterCategoryRules                               = [
  ["라이브", "우리 얘기 좀 합시다", ["ㅇㅇㅎ", "ㅜㅒ합", "우얘합", "우예합", "우리얘기좀합시다"]],
  ["라이브", "하루의 마무리", ["ㅎㄹㅇㅁㅁㄹ", "ㅎrㅁr", "하루의마무리", "하마"]],
  ["라이브", "승구리당당", ["승구리당당", "슩구리당당", "수다당"]],
  ["유튜브", "레코딩로그", ["레코딩로그", "녹음로그", "ㄹㅋㄷㄹㄱ"]],
  ["유튜브", "승캠", ["승캠", "슩캠", "가슩컘"]],
  ["유튜브", "엔킷리스트", ["ㅇㅋㄹㅅㅌ", "엔킷리스트", "엕킷리스트"]],
  ["유튜브", "버킷리스트", ["버킷리스트", "ㅂㅋㄹㅅㅌ"]],
  ["유튜브", "합주일지", ["합주일지", "ㅎㅈㅇㅈ"]],
  ["무대영상", "콘서트", ["엔콘", "엕콘", "ㅇㅋ1", "ㅇㅋ2", "ㅇㅋ3", "ㅇㅋ4", "ㅇㅋ5", "ㄴㅌ5", "하이드ㅇㅇ", "ㅎㅇㄷㅇㅇ", "하이드아웃", "ㅇㅁㅎ"]],
  ["무대영상", "팬미팅", ["ㅇㅅㅎ", "우사ㅎ"]],
  ["무대영상", "페스티벌", ["ㅇㅆㅅㅌㅇㅈ", "어썸스테이ㅈ", "어썸스테이지", "ㄱㅁㅍ", "ㅂㅁㄹ"]],
  ["무대영상", "음악방송", ["음ㅈ", "뮤ㅂ", "쇼ㅊ", "인ㄱ", "엠ㅋ", "뮤직뱅ㅋ", "뮤직뱅크", "음악중심", "인기가요", "쇼챔피언", "엠카운트다운"]],
  ["무대영상", "팬싸인회", ["팬싸", "팬사인회", "팬싸인회"]],
  ["무대영상", "버스킹", ["버스킹", "청ㄱ광장"]],
  ["미디어", "방송/예능", ["ㅂㄱㅇㄱㅇ", "ㄷㅇㅇㄷㅂㄷ"]],
  ["미디어", "웹예능/웹컨텐츠", ["딩ㄱ", "잇ㅊ라이브", "잇츠라이브"]],
  ["미디어", "라디오", ["횅키라", "행키라"]],
  ["미디어", "잡지/화보", ["더링"]],
  ["미디어", "인터뷰", ["인터뷰"]],
  ["SNS", "공식 카페", ["공카", "공식카페"]],
  ["SNS", "공식 인스타그램", ["공식인스타", "공식ig"]],
];
                                                                                        
const noTwitterCategory = ()                       => ({ mainCategory: "", subCategory: "", rule: "" });
const compactTwitterHeading = (value        ) => value.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}ㄱ-ㅎㅏ-ㅣ]/gu, "");
function twitterScheduleHeading(value         ) {
  const title = text(value).replace(/&amp;/g, "&");
  // Only a date-led heading is evidence. Dialogue, hashtags and later paragraphs
  // must not turn an incidental mention into a category.
  const lines = title.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  while (lines.length && /^#[^\s]+(?:\s+#[^\s]+)*$/.test(lines[0])) lines.shift();
  const match = lines.slice(0, 2).join("\n").match(/^[^\p{L}\p{N}\n]{0,8}(?:20\d{6}|\d{6})[\s._/|:\-\[\]()]*(.+)/u);
  if (!match) return "";
  return match[1].split(/#|https?:\/\/|\s[🦊🐰]/u)[0].trim().slice(0, 80);
}
export function inferTwitterCategory(title         )                       {
  const rawHeading = twitterScheduleHeading(title);
  const heading = compactTwitterHeading(rawHeading);
  const firstToken = compactTwitterHeading(rawHeading.split(/\s/)[0] || "");
  if (!heading) return noTwitterCategory();
  const matches = twitterCategoryRules.flatMap(([mainCategory, subCategory, aliases]) => aliases.filter(alias => {
    const normalized = compactTwitterHeading(alias);
    if (!heading.startsWith(normalized)) return false;
    if (firstToken.startsWith(normalized)) {
      if (/[ㄱ-ㅎㅏ-ㅣ]$/.test(normalized) && /^[ㄱ-ㅎㅏ-ㅣ]/.test(firstToken.slice(normalized.length))) return false;
      if (/\d$/.test(normalized) && /^\d/.test(firstToken.slice(normalized.length))) return false;
    }
    return true;
  }).map(alias => ({ mainCategory, subCategory, rule: alias, length: compactTwitterHeading(alias).length })));
  matches.sort((a, b) => b.length - a.length);
  const base = matches[0];
  const descriptor = heading.slice(0, 24);
  // Preserve explicit source/platform labels; ignore incidental story mentions.
  if (base && (base.mainCategory === "SNS" || base.subCategory === "잡지/화보")) return { mainCategory: base.mainCategory, subCategory: base.subCategory, rule: base.rule };
  if (!base && !/^(?:레코딩로그|녹음로그|ㄹㅋㄷㄹㄱ|비하인드|메이킹|직캠|인스타라이브|iglive)/.test(heading)) return noTwitterCategory();
  const overrides                             = [];
  if (/(?:레코딩로그|녹음로그|ㄹㅋㄷㄹㄱ)/.test(descriptor)) overrides.push(["유튜브", "레코딩로그", "레코딩로그"]);
  if (/(?:비하인드|ㅂㅎㅇㄷ)/.test(descriptor)) {
    if (base?.subCategory === "페스티벌" && !/(?:필름|영상|유튜브)/.test(descriptor)) return noTwitterCategory();
    if (base?.subCategory === "음악방송") return noTwitterCategory();
    overrides.push(["유튜브", "비하인드", "비하인드"]);
  }
  if (/(?:메이킹|ㅁㅇㅋ)/.test(descriptor)) overrides.push(["유튜브", "메이킹", "메이킹"]);
  if (/(?:직캠|ㅈㅋ)/.test(descriptor)) overrides.push(["무대영상", "직캠", "직캠"]);
  if (/(?:공식블로그|네이버블로그)/.test(descriptor)) overrides.push(["SNS", "공식 블로그", "공식 블로그"]);
  if (base?.subCategory === "음악방송" && /인터뷰/.test(descriptor)) overrides.push(["미디어", "인터뷰", "인터뷰"]);
  if (/(?:인스타|ig)(?:그램)?라이브|iglive/.test(descriptor)) overrides.push(["라이브", "인스타그램 라이브", "인스타 라이브"]);
  if (overrides.length > 1) return noTwitterCategory();
  if (overrides.length === 1) {
    const [mainCategory, subCategory, rule] = overrides[0];
    return { mainCategory, subCategory, rule };
  }
  if (base?.mainCategory === "무대영상" && /(?:뒤풀이|라이브|공방포카|셀카|포스터|네이버포스트|음성메시지|트위터|인스타|프롬|버블)/.test(descriptor)) return noTwitterCategory();
  if (!matches.length) return noTwitterCategory();
  matches.sort((a, b) => b.length - a.length);
  const longest = matches.filter(item => item.length === matches[0].length);
  if (new Set(longest.map(item => `${item.mainCategory}/${item.subCategory}`)).size !== 1) return noTwitterCategory();
  return { mainCategory: longest[0].mainCategory, subCategory: longest[0].subCategory, rule: longest[0].rule };
}

// Classification happens before draft saving and never calls X or an AI API.
export async function classifyTwitterPage(result, { loadPairs, loadRoot }) {
  if (result.classificationPrepared) return result;
  const items = (result.items || []).map(item => ({ ...item }));
  const idOf = item => text(item.link).match(/\/status\/(\d+)/)?.[1] || '';
  const roots = new Map(items.map(item => [idOf(item), item.title]));
  let warning = '';
  try {
    const allowed = await loadPairs();
    const missing = [...new Set(items.map(item => text(item.twitterConversationId) || idOf(item)).filter(id => /^\d{1,20}$/.test(id) && !roots.has(id)))];
    // Four bounded archive reads at a time; never fetch missing tweets from X.
    for (let offset = 0; offset < missing.length; offset += 4) {
      await Promise.all(missing.slice(offset, offset + 4).map(async id => {
        const root = await loadRoot(id);
        if (root && idOf(root) === id) roots.set(id, root.title);
      }));
    }
    for (const item of items) {
      if (item.mainCategory || item.subCategory) continue;
      const guess = inferTwitterCategory(roots.get(text(item.twitterConversationId) || idOf(item)));
      if (allowed.has(guess.mainCategory + '/' + guess.subCategory)) {
        item.mainCategory = guess.mainCategory;
        item.subCategory = guess.subCategory;
      }
    }
  } catch {
    warning = '일부 자동 분류를 확인하지 못했습니다. 분류가 없는 자료는 미분류로 저장합니다.';
  }
  return { ...result, items, classificationPrepared: true, autoClassified: items.filter(item => item.mainCategory && item.subCategory).length, warning: [result.warning, warning].filter(Boolean).join(' ') };
}
