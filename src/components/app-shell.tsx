import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TrySquareMark } from "./shop-marks";

export function AppShell({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 pt-[5px] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 text-fg">
            <span className="flex size-8 items-center justify-center rounded-sm bg-accent text-accent-fg">
              <TrySquareMark className="size-4" />
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-lg tracking-tight">Shopwright</span>
              <span className="hidden text-xs text-muted sm:inline">the bench</span>
            </span>
          </Link>
          {action}
        </div>
      </header>
      {children}
    </div>
  );
}
