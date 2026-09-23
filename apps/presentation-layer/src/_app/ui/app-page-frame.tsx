"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AiSanaLogo } from "@/shared/components/ai-sana-logo";
import { ThemeToggle } from "@/shared/components/theme-toggle";

export function AppPageFrame({ children, teamId }: { children: ReactNode; teamId?: string }) {
  const pathname = usePathname();
  const isTaskPage = pathname === "/task-match" || pathname === "/catalog" || pathname.startsWith("/teams/");
  if (!isTaskPage) return <><nav className="border-b px-4 py-2 text-sm"><Link href="/task-match">Мэтч задач: от черновика до результата</Link></nav>{children}</>;

  const links = [
    { href: "/", label: "Рабочее пространство" },
    { href: "/task-match", label: "Задачи" },
    { href: "/catalog", label: "Каталог" },
    ...(teamId ? [{ href: `/teams/${teamId}/recommendations`, label: "Рекомендации" }] : []),
  ];
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-workspace-surface">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
          <Link href="/" aria-label="AI Sana — рабочее пространство" data-logo-trigger className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"><AiSanaLogo className="h-5 w-24" /></Link>
          <nav aria-label="Основная навигация" className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${pathname === href ? "bg-workspace-selected text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</Link>)}
          </nav>
          <div className="ml-auto"><ThemeToggle /></div>
        </div>
      </header>
      <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto pb-32 sm:pb-24">{children}</div>
    </div>
  );
}
