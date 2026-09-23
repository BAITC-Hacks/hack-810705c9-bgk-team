import type { SVGProps } from "react";
import { cn } from "@/shared/lib/utils";
import styles from "./ai-sana-logo.module.css";

const LETTERS = ["mark", "i", "s", "a-first", "n", "a-last"] as const;

/** Add data-logo-trigger to the containing button or link to enable motion. */
export function AiSanaLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="16 51 569 129"
      fill="currentColor"
      role="img"
      aria-label="AI Sana"
      focusable="false"
      className={cn(styles.logo, className)}
      {...props}
    >
      {LETTERS.map((letter, index) => (
        <use
          key={letter}
          href={`/ai-sana-logo.svg#${letter}`}
          className={styles.letter}
          style={{ animationDelay: `${index * 40}ms` }}
        />
      ))}
    </svg>
  );
}
