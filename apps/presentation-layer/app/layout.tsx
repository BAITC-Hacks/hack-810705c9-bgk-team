import { Providers } from "@/_app/providers";
import { AppShell } from "@/_app/ui/app-shell";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "@/_app/styles/globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI-Sana — рабочее пространство",
  description:
    "Рабочее пространство бизнеса и студенческих команд AI-Sana.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${roboto.variable} h-full overflow-hidden antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-hidden">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
