import { ThemeControl } from "@/components/theme-control";
import { BrandProvider } from "@/components/site-brand";
import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./reference-ui.css";
import "./study-workbench.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "柜联 CabinLink",
  description: "按主题整理照片和文件，通过链接与登录成员共享、浏览和下载。",
  openGraph: {
    title: "柜联 CabinLink",
    description: "把照片和文件，放进同一个柜子。",
    images: [{ url: "/cabinlink-poster.png", width: 1122, height: 1402, alt: "柜联网站介绍海报" }],
  },
  icons: {
    icon: "/site-logo.png",
    shortcut: "/site-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('cabinlink-theme')||'original'}catch(e){}"}}/><ThemeControl/><BrandProvider>{children}</BrandProvider>
        <footer className="site-footer" aria-label="免责声明">
          <span className="site-footer-label">免责声明</span>
          <span>本项目由华北水利水电大学陈会闯开发，仅供学习和参考。</span>
        </footer>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
