import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppShell({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="font-display text-lg tracking-tight">Shopwright</span>
            <span className="hidden text-xs text-muted sm:inline">v0.1</span>
          </Link>
          {action}
        </div>
      </header>
      {children}
    </div>
  );
}
