import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "로펙 찐 악세 효율 계산기",
  description: "내 캐릭에 맞는 악세 효율 찾기 - 경매장 매물별 로펙점수 상승 비교 및 시각화"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
