import { Providers } from "@/_app/providers";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/_app/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sana — идеи становятся задачами",
  description:
    "Рабочее пространство бизнеса и студенческих команд. Интерактивное демо AI Sana.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
