import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "paper" | "warn" | "good" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide",
        tone === "muted" && "bg-surface-2 text-muted",
        tone === "paper" && "bg-paper/15 text-paper",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "good" && "bg-good/15 text-good",
        className,
      )}
      {...props}
    />
  );
}
