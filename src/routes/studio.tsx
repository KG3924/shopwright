import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StudioView } from "@/components/studio-view";

export const Route = createFileRoute("/studio")({ component: Studio });

function Studio() {
  return (
    <AppShell>
      <StudioView />
    </AppShell>
  );
}
