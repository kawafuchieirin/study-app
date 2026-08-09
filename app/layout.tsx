import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manabi｜学びを、次の一歩につなげる",
  description: "計画・学習・AI解説・振り返りをひとつにつなぐ学習伴走アプリ。",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Manabi", description: "学びを、次の一歩につなげる。", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Manabi", description: "学びを、次の一歩につなげる。", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
