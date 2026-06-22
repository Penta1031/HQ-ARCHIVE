export const ARCHIVE_LANGUAGE_OPTIONS = [
  { code: "ko", short: "KR", label: "한국어" },
  { code: "zh", short: "中", label: "中文" },
  { code: "ja", short: "日", label: "日本語" },
  { code: "en", short: "EN", label: "English" }
];

export const ARCHIVE_TEXT = {
  ko: {
    archive: "아카이브", keywords: "키워드", today: "N년전 오늘",
    searchPlaceholder: "제목, 키워드, 날짜로 검색", categoryHint: "← 좌우로 밀어서 카테고리를 확인하세요 →", keywordHint: "← 좌우로 밀어서 키워드를 확인하세요 →",
    all: "전체", unit: "개", latest: "최신순", oldest: "과거순", more: "더보기 (+30)", loadingMore: "다음 30개 불러오는 중…",
    empty: "조건에 맞는 기록이 없어요.", random: "랜덤 추천", randomTitle: "오늘의 랜덤 기록", randomAgain: "다시 추천", openOriginal: "원본 보기",
    todayTitle: "{month}월 {day}일의 기록", yearsAgo: "{years}년 전 오늘"
  },
  zh: {
    archive: "存档", keywords: "关键词", today: "往年今日",
    searchPlaceholder: "搜索标题、关键词或日期", categoryHint: "← 左右滑动查看分类 →", keywordHint: "← 左右滑动查看关键词 →",
    all: "全部", unit: "个", latest: "最新", oldest: "最早", more: "加载更多 (+30)", loadingMore: "正在加载…",
    empty: "暂无符合条件的记录。", random: "随机推荐", randomTitle: "今日随机记录", randomAgain: "再次推荐", openOriginal: "查看原文",
    todayTitle: "{month}月{day}日的记录", yearsAgo: "{years}年前的今天"
  },
  ja: {
    archive: "アーカイブ", keywords: "キーワード", today: "過去の今日",
    searchPlaceholder: "タイトル・キーワード・日付で検索", categoryHint: "← 左右にスワイプしてカテゴリーを確認 →", keywordHint: "← 左右にスワイプしてキーワードを確認 →",
    all: "すべて", unit: "件", latest: "最新順", oldest: "古い順", more: "もっと見る (+30)", loadingMore: "読み込み中…",
    empty: "条件に一致する記録がありません。", random: "ランダム推薦", randomTitle: "今日のランダム記録", randomAgain: "もう一度", openOriginal: "元の投稿を見る",
    todayTitle: "{month}月{day}日の記録", yearsAgo: "{years}年前の今日"
  },
  en: {
    archive: "Archive", keywords: "Keyword", today: "On This Day",
    searchPlaceholder: "Search by title, keyword, or date", categoryHint: "← Swipe sideways to browse categories →", keywordHint: "← Swipe sideways to browse keywords →",
    all: "All", unit: " items", latest: "Latest", oldest: "Oldest", more: "Load More (+30)", loadingMore: "Loading…",
    empty: "No matching records found.", random: "Random Pick", randomTitle: "Random Archive Pick", randomAgain: "Pick Again", openOriginal: "Open Original",
    todayTitle: "Archive for {month}/{day}", yearsAgo: "{years} years ago today"
  }
};

const CATEGORY_TRANSLATIONS = {
  en: {
    "전체": "All", "무대영상": "Performance", "라이브": "Live", "유튜브": "YouTube", "미디어": "Media", "SNS": "SNS", "메시지": "Message", "기타": "Other",
    "음악방송": "Music Show", "직캠": "Fancam", "콘서트": "Concert", "페스티벌": "Festival", "대학축제": "University Festival", "버스킹": "Busking", "쇼케이스": "Showcase", "팬미팅": "Fan Meeting", "팬싸인회": "Fan Sign", "공항/퇴근길": "Airport/After Work", "해외투어": "World Tour", "킹덤": "Kingdom",
    "하루의 마무리": "End of the Day", "승협이 라이브": "Seunghyub Live", "승구리당당": "Seungguri Dangdang", "우리 얘기 좀 합시다": "Let's Talk", "개인 라이브": "Solo Live", "단체 라이브": "Group Live", "인스타그램 라이브": "Instagram Live", "기타 라이브": "Other Live",
    "뮤직비디오": "Music Video", "메이킹": "Making Film", "비하인드": "Behind the Scenes", "레코딩로그": "Recording Log", "승캠": "SeungCam", "승협이": "Seunghyub", "합주일지": "Rehearsal Log", "커버곡": "Cover Song", "스페셜클립": "Special Clip", "쇼츠": "Shorts", "엔킷리스트": "N.Kit List", "버킷리스트": "Bucket List", "냉탕과온탕사이": "Between Cold & Hot",
    "방송/예능": "TV/Variety", "뮤직웨이브": "Music Wave", "라디오": "Radio", "인터뷰": "Interview", "잡지/화보": "Magazine/Photo Shoot", "웹예능/웹컨텐츠": "Web Variety/Web Content",
    "공식 트위터": "Official Twitter", "개인 인스타그램": "Personal Instagram", "공식 인스타그램": "Official Instagram", "릴스": "Reels", "틱톡": "TikTok", "공식 카페": "Official Fan Cafe", "공식 블로그": "Official Blog",
    "버블": "Bubble", "프롬": "Fromm", "연말결산": "Year-end Review", "백업": "Backup", "목격담": "Sighting", "모음집": "Collection"
  },
  zh: {
    "전체": "全部", "무대영상": "舞台视频", "라이브": "直播", "유튜브": "YouTube", "미디어": "媒体", "SNS": "SNS", "메시지": "消息", "기타": "其他",
    "음악방송": "音乐节目", "직캠": "直拍", "콘서트": "演唱会", "페스티벌": "音乐节", "대학축제": "大学庆典", "버스킹": "街头演出", "쇼케이스": "Showcase", "팬미팅": "粉丝见面会", "팬싸인회": "签售会", "공항/퇴근길": "机场/下班路", "해외투어": "海外巡演", "킹덤": "Kingdom",
    "하루의 마무리": "一天的结束", "승협이 라이브": "承协直播", "승구리당당": "胜古里堂堂", "우리 얘기 좀 합시다": "我们聊聊吧", "개인 라이브": "个人直播", "단체 라이브": "团体直播", "인스타그램 라이브": "Instagram直播", "기타 라이브": "其他直播",
    "뮤직비디오": "音乐视频", "메이킹": "制作花絮", "비하인드": "幕后花絮", "레코딩로그": "录音日志", "승캠": "SeungCam", "승협이": "承协", "합주일지": "合奏日志", "커버곡": "翻唱歌曲", "스페셜클립": "特别片段", "쇼츠": "Shorts", "엔킷리스트": "N.Kit List", "버킷리스트": "愿望清单", "냉탕과온탕사이": "冷水与热水之间",
    "방송/예능": "电视/综艺", "뮤직웨이브": "Music Wave", "라디오": "电台", "인터뷰": "采访", "잡지/화보": "杂志/画报", "웹예능/웹컨텐츠": "网络综艺/网络内容",
    "공식 트위터": "官方Twitter", "개인 인스타그램": "个人Instagram", "공식 인스타그램": "官方Instagram", "릴스": "Reels", "틱톡": "TikTok", "공식 카페": "官方粉丝社区", "공식 블로그": "官方博客",
    "버블": "Bubble", "프롬": "Fromm", "연말결산": "年终总结", "백업": "备份", "목격담": "目击记录", "모음집": "合集"
  },
  ja: {
    "전체": "すべて", "무대영상": "ステージ映像", "라이브": "ライブ", "유튜브": "YouTube", "미디어": "メディア", "SNS": "SNS", "메시지": "メッセージ", "기타": "その他",
    "음악방송": "音楽番組", "직캠": "ファンカム", "콘서트": "コンサート", "페스티벌": "フェスティバル", "대학축제": "大学祭", "버스킹": "路上ライブ", "쇼케이스": "ショーケース", "팬미팅": "ファンミーティング", "팬싸인회": "サイン会", "공항/퇴근길": "空港/退勤", "해외투어": "海外ツアー", "킹덤": "KINGDOM",
    "하루의 마무리": "一日の締めくくり", "승협이 라이브": "スンヒョプライブ", "승구리당당": "スングリダンダン", "우리 얘기 좀 합시다": "私たち、話しましょう", "개인 라이브": "個人ライブ", "단체 라이브": "グループライブ", "인스타그램 라이브": "Instagramライブ", "기타 라이브": "その他のライブ",
    "뮤직비디오": "ミュージックビデオ", "메이킹": "メイキング", "비하인드": "ビハインド", "레코딩로그": "レコーディングログ", "승캠": "スンカム", "승협이": "スンヒョプ", "합주일지": "合奏日誌", "커버곡": "カバー曲", "스페셜클립": "スペシャルクリップ", "쇼츠": "Shorts", "엔킷리스트": "N.Kit List", "버킷리스트": "バケットリスト", "냉탕과온탕사이": "冷水とお湯の間",
    "방송/예능": "テレビ/バラエティ", "뮤직웨이브": "ミュージックウェーブ", "라디오": "ラジオ", "인터뷰": "インタビュー", "잡지/화보": "雑誌/グラビア", "웹예능/웹컨텐츠": "Webバラエティ/Webコンテンツ",
    "공식 트위터": "公式Twitter", "개인 인스타그램": "個人Instagram", "공식 인스타그램": "公式Instagram", "릴스": "Reels", "틱톡": "TikTok", "공식 카페": "公式ファンカフェ", "공식 블로그": "公式ブログ",
    "버블": "Bubble", "프롬": "Fromm", "연말결산": "年末まとめ", "백업": "バックアップ", "목격담": "目撃談", "모음집": "まとめ"
  }
};

const KEYWORD_TRANSLATIONS = {
  en: { "모음집": "Collection", "이마키스": "Forehead Kiss", "질투": "Jealousy", "친지마": "Chinjima", "투샷": "Two-shot", "셀카": "Selfie", "하크잖": "Hakeujan", "커플템": "Matching Item" },
  zh: { "모음집": "合集", "이마키스": "额头吻", "질투": "嫉妒", "친지마": "Chinjima", "투샷": "双人照", "셀카": "自拍", "하크잖": "Hakeujan", "커플템": "情侣同款" },
  ja: { "모음집": "まとめ", "이마키스": "おでこキス", "질투": "嫉妬", "친지마": "Chinjima", "투샷": "ツーショット", "셀카": "セルカ", "하크잖": "Hakeujan", "커플템": "おそろいアイテム" }
};

export function archiveCategoryLabel(language, key) {
  if (language === "ko") return key;
  return CATEGORY_TRANSLATIONS[language]?.[key] || key;
}

export function archiveKeywordLabel(language, key) {
  if (language === "ko") return key;
  return KEYWORD_TRANSLATIONS[language]?.[key] || key;
}

export function archiveText(language, key, values = {}) {
  const template = ARCHIVE_TEXT[language]?.[key] || ARCHIVE_TEXT.ko[key] || key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}
