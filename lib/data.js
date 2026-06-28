const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`;

export const archiveItems = [
  { id: "a1", title: "무대 위에서 발견한 완벽한 순간", mainCategory: "무대", subCategory: "음악방송", date: "2026-06-21", keywords: ["레전드착장", "엔딩요정"], thumbnailUrl: img("photo-1501386761578-eac5c94b800a") },
  { id: "a2", title: "웃음이 끊이지 않았던 비하인드", mainCategory: "콘텐츠", subCategory: "비하인드", date: "2026-06-21", keywords: ["케미", "웃음버튼"], thumbnailUrl: img("photo-1529139574466-a303027c1d8b") },
  { id: "a3", title: "오늘의 출국길 공항 패션", mainCategory: "일상", subCategory: "공항", date: "2025-06-21", keywords: ["레전드착장", "공항패션"], thumbnailUrl: img("photo-1529139574466-a303027c1d8b") },
  { id: "a4", title: "여름 페스티벌을 찢은 라이브", mainCategory: "무대", subCategory: "페스티벌", date: "2024-06-21", keywords: ["라이브", "직캠"], thumbnailUrl: img("photo-1492684223066-81342ee5ff30") },
  { id: "a5", title: "팬들과 함께한 기념 라이브", mainCategory: "콘텐츠", subCategory: "라이브", date: "2026-06-14", keywords: ["팬사랑", "라이브"], thumbnailUrl: img("photo-1514525253161-7a46d19cd819") },
  { id: "a6", title: "한강에서 보낸 느린 오후", mainCategory: "일상", subCategory: "SNS", date: "2026-06-08", keywords: ["힐링", "일상"], thumbnailUrl: img("photo-1529156069898-49953e39b3ac") },
  { id: "a7", title: "첫 단독 콘서트의 마지막 인사", mainCategory: "무대", subCategory: "콘서트", date: "2023-06-21", keywords: ["눈물버튼", "콘서트"], thumbnailUrl: img("photo-1540039155733-5bb30b53aa14") },
  { id: "a8", title: "서로에게 보내는 진심 어린 편지", mainCategory: "콘텐츠", subCategory: "인터뷰", date: "2026-05-29", keywords: ["케미", "눈물버튼"], thumbnailUrl: img("photo-1483412033650-1015ddeb83d1") }
];

export const keywordGroups = [
  { label: "레전드 모먼트", tags: ["레전드착장", "엔딩요정", "눈물버튼", "웃음버튼"] },
  { label: "무대", tags: ["직캠", "라이브", "콘서트", "페스티벌"] },
  { label: "관계성", tags: ["케미", "팬사랑", "서로에게", "비하인드"] },
  { label: "일상", tags: ["공항패션", "힐링", "SNS", "먹방"] }
];

export const worldcups = [
  { id: "w1", title: "다시 보고 싶은 레전드 무대", description: "심장을 뛰게 한 무대 중 단 하나를 골라주세요.", coverUrl: img("photo-1506157786151-b8491531f063"), playCount: 12842, candidates: archiveItems.filter((x) => x.mainCategory === "무대") },
  { id: "w2", title: "최애 착장 월드컵", description: "스타일링 팀도 울고 갈 최고의 룩은?", coverUrl: img("photo-1460661419201-fd4cecdf8a8b"), playCount: 8931, candidates: [archiveItems[0], archiveItems[2], archiveItems[5], archiveItems[7]] },
  { id: "w3", title: "웃음 버튼 모먼트", description: "보기만 해도 자동 재생되는 그 장면.", coverUrl: img("photo-1527529482837-4698179dc6ce"), playCount: 6740, candidates: [archiveItems[1], archiveItems[4], archiveItems[5], archiveItems[7]] }
];

export const globalRanking = [
  { rank: 1, title: "무대 위에서 발견한 완벽한 순간", wins: 3842, imageUrl: archiveItems[0].thumbnailUrl },
  { rank: 2, title: "첫 단독 콘서트의 마지막 인사", wins: 2917, imageUrl: archiveItems[6].thumbnailUrl },
  { rank: 3, title: "여름 페스티벌을 찢은 라이브", wins: 2360, imageUrl: archiveItems[3].thumbnailUrl }
];
