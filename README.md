# HQ ARCHIVE

흩어져 있던 팬 아카이브, 추천 영상, N년 전 오늘을 하나로 모은 모바일 웹앱입니다.

## 미리보기

https://penta1031.github.io/HQ-ARCHIVE/

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 데이터 연동

현재 UI는 `lib/data.js`의 더미 데이터를 사용합니다. 실제 Google Sheets와 Supabase 연동은 `lib/services.js`의 서비스 함수 구현만 교체하도록 분리되어 있습니다. 필요한 환경 변수는 `.env.example`을 참고하세요.

### X/Twitter 월드컵 미디어

`apps-script/TWITTER_MEDIA_RESOLVER.gs`를 기존 HQ ARCHIVE Apps Script 프로젝트에 추가하고, 기존 `doPost(e)`에 파일 상단 주석의 두 줄을 연결한 뒤 웹 앱을 새 버전으로 배포합니다. 프론트는 이 액션을 우선 사용해 트윗 카드가 아닌 이미지·영상 URL만 표시하며, 아직 서버가 배포되지 않은 경우 기존 브라우저 폴백을 사용합니다.

## 위키 (hq-index)

`wiki/`는 https://hq-index.vercel.app/ 위키 사이트입니다. Vercel `hq-index` 프로젝트가 이 저장소의 `wiki/` 폴더(Root Directory)를 배포하며, `wiki/` 아래가 바뀐 커밋이 `main`에 들어오면 자동 배포됩니다.

- `wiki/dist/` 정적 사이트와 큐레이션 데이터(공식 일정, 공연·라디오·웹예능 연결, 영상 연결)
- `wiki/api/`, `wiki/server/` Supabase 프록시와 방명록 API (키는 Vercel 환경 변수)

### 공식 일정 업데이트

공식 일정의 원본은 `wiki/dist/calendar-schedules.json` 하나이며, 아카이브 캘린더(`public/official-calendar.json`)는 여기서 생성합니다.

```bash
npm run calendar:fnc    # FNC 공식 스케줄을 wiki/dist/calendar-schedules.json에 반영
npm run calendar:sync   # 위키 데이터 + 실시간 아카이브 기록으로 public/official-calendar.json 생성
```

## 배포

Next.js App Router 기반이며 Vercel에 바로 배포할 수 있습니다.
