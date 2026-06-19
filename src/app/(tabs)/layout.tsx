import type { ReactNode } from "react";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function TabsLayout({ children }: { children: ReactNode }) {
  const viewerId = await requireMobileViewerOrRedirect();
  return <MobileShell viewerId={viewerId}>{children}</MobileShell>;
}
