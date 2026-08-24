import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      suppressHydrationWarning
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
      {...props}
    />
  );
}
