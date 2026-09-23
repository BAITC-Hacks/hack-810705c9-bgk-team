"use client";

import { useSyncExternalStore } from "react";
import { Check, Display, Moon, Sun } from "@gravity-ui/icons";
import { useTheme } from "next-themes";
import { IconAction } from "@/shared/components/icon-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Системная", icon: Display },
] as const;

const subscribeMounted = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMounted,
    getServerMounted,
  );
  const { theme, resolvedTheme, setTheme } = useTheme();

  // The saved preference is available only in the browser; keep SSR stable.
  if (!mounted) {
    return (
      <IconAction label="Тема оформления" disabled>
        <Sun className="size-4" aria-hidden="true" />
      </IconAction>
    );
  }

  const current = THEMES.find((option) => option.value === theme) ?? THEMES[2];
  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconAction label={`Тема оформления: ${current.label.toLocaleLowerCase("ru")}`}>
          <CurrentIcon className="size-4" aria-hidden="true" />
        </IconAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-xl p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5">Тема оформления</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            role="menuitemradio"
            aria-checked={current.value === value}
            onSelect={() => setTheme(value)}
            className="min-h-9 gap-2.5 px-2 text-[13px]"
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 font-medium">{label}</span>
            {current.value === value ? (
              <Check className="size-4" aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
