import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/layout/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ai-hot-news — 第一时间发现热点",
  description: "实时监控全网热点，AI 智能过滤，秒级推送。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        {/* 极淡网格做底纹（仅大块留白处感知） */}
        <div className="fixed inset-0 bg-grid pointer-events-none" />
        {/* 顶部一抹绿光 */}
        <div className="fixed inset-x-0 top-0 h-[400px] bg-glow-top pointer-events-none" />

        <div className="relative flex min-h-screen flex-col">
          <TopBar />
          <main className="flex-1">{children}</main>
          <footer className="mt-16 border-t border-border-default">
            <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between text-[11.5px] text-text-muted">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent-bright pulse-dot" />
                  <span>Online</span>
                </span>
                <span className="text-text-faint">·</span>
                <span className="mono">deepseek-chat-v3.1</span>
                <span className="text-text-faint">·</span>
                <span>8 sources · every 30 min</span>
              </div>
              <span className="hidden sm:flex items-center gap-1.5">
                Press <kbd>⌘K</kbd> to search
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
