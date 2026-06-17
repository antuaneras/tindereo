import type { ReactNode } from "react";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { getMobileViewerSummary } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function TabsLayout({ children }: { children: ReactNode }) {
  const viewerId = await requireMobileViewerOrRedirect();
  const summary = await getMobileViewerSummary(viewerId);

  return <MobileShell initialSummary={summary}>{children}</MobileShell>;
}
