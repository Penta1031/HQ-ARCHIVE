# HQ ARCHIVE

흩어져 있던 팬 아카이브, 월드컵, 포타 검색기, N년 전 오늘을 하나로 모은 모바일 웹앱입니다.

## 미리보기

https://penta1031.github.io/hq-record-archive/

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 데이터 연동

현재 UI는 `lib/data.js`의 더미 데이터를 사용합니다. 실제 Google Sheets와 Supabase 연동은 `lib/services.js`의 서비스 함수 구현만 교체하도록 분리되어 있습니다. 필요한 환경 변수는 `.env.example`을 참고하세요.

## 배포

Next.js App Router 기반이며 Vercel에 바로 배포할 수 있습니다.
