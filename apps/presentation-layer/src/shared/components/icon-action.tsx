"use client";

import type { ComponentProps } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

type IconActionProps = ComponentProps<typeof Button> & {
  label: string;
  shortcut?: string;
};

/** A compact action with the same accessible name in its button and tooltip. */
export function IconAction({
  label,
  shortcut,
  children,
  variant = "ghost",
  size = "icon",
  type = "button",
  ...props
}: IconActionProps) {
  return (
    <TooltipProvider delayDuration={350}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            {...props}
            type={type}
            variant={variant}
            size={size}
            aria-label={label}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          <span>{label}</span>
          {shortcut ? (
            <kbd className="ml-1 font-sans text-[11px] text-background/65">
              {shortcut}
            </kbd>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
