import "./globals.css";

export const metadata = {
  title: "HQ ARCHIVE",
  description: "흩어진 순간을 한곳에, HQ 팬 아카이브"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
