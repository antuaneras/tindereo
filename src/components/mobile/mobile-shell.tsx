"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Camera, Compass, MessageCircleMore, Search } from "lucide-react";
import { enableWebPushNotifications } from "@/lib/tindereo-push-client";
import { fetchViewerSummary, subscribeToMobileStream } from "@/lib/mobile-api";
import type { MobileViewerSummary } from "@/lib/mobile-types";

type MobileShellProps = {
  children: React.ReactNode;
  initialSummary: MobileViewerSummary;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function renderProfileAvatar(summary: MobileViewerSummary) {
  if (summary.profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={summary.profile.avatarUrl}
        alt={`@${summary.profile.handle}`}
        className="h-7 w-7 rounded-full object-cover ring-2 ring-white/90"
      />
    );
  }

  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-main)] ring-2 ring-white/90">
      {summary.profile.handle.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function MobileShell({ children, initialSummary }: MobileShellProps) {
  const currentPath = usePathname();
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const isCreateRoute = currentPath.startsWith("/crear");
  const hideNavigation = isCreateRoute;

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const nextSummary = await fetchViewerSummary();
        if (!cancelled) {
          setSummary(nextSummary);
        }
      } catch {
        // Ignore background shell refresh issues.
      }
    };

    const unsubscribe = subscribeToMobileStream((event) => {
      if (event.type === "notifications" || event.type === "conversation" || event.type === "stories" || event.type === "profile" || event.type === "bootstrap") {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const alreadyPrompted = window.localStorage.getItem("mobile-push-prompted");
    if (alreadyPrompted) {
      return;
    }

    window.localStorage.setItem("mobile-push-prompted", "1");
    void enableWebPushNotifications().catch(() => undefined);
  }, []);

  useEffect(() => {
    const routes = ["/inicio", "/buscar", "/crear", "/chats", "/perfil"];
    const runPrefetch = () => {
      routes.forEach((href) => router.prefetch(href));
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(runPrefetch, 200);
    return () => window.clearTimeout(timeoutId);
  }, [router]);

  const items = useMemo(
    () => [
      { href: "/inicio", label: "Inicio", icon: <Compass className="h-5 w-5" />, active: currentPath.startsWith("/inicio") },
      { href: "/buscar", label: "Buscar", icon: <Search className="h-5 w-5" />, active: currentPath.startsWith("/buscar") },
      { href: "/crear", label: "Crear", icon: <Camera className="h-6 w-6" />, active: currentPath.startsWith("/crear"), center: true },
      {
        href: "/chats",
        label: "Chats",
        icon: <MessageCircleMore className="h-5 w-5" />,
        active: currentPath.startsWith("/chats"),
        badge: summary.pendingChatCount
      },
      {
        href: "/perfil",
        label: "Perfil",
        icon: renderProfileAvatar(summary),
        active: currentPath.startsWith("/perfil")
      }
    ],
    [currentPath, summary]
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
      <main
        className={cn(
          "flex-1",
          isCreateRoute
            ? "p-0"
            : "px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]"
        )}
      >
        {children}
      </main>
      {hideNavigation ? null : (
        <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[480px] -translate-x-1/2 items-end justify-between border-t border-[var(--line-soft)] bg-[rgba(246,239,231,0.96)] px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              scroll={false}
              onMouseEnter={() => router.prefetch(item.href)}
              onTouchStart={() => router.prefetch(item.href)}
              className={cn(
                "relative flex min-w-[56px] flex-col items-center gap-1 text-[11px] font-medium text-[var(--text-soft)] transition",
                item.active && "text-[var(--coral)]",
                item.center && "-mt-8"
              )}
            >
              <span
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-soft)] bg-white/80 shadow-[0_12px_28px_rgba(29,22,15,0.08)]",
                  item.center && "h-16 w-16 border-transparent bg-gradient-to-br from-[var(--coral)] to-[var(--orange)] text-white shadow-[0_16px_36px_rgba(240,138,36,0.32)]",
                  item.active && !item.center && "border-[rgba(255,107,87,0.24)] text-[var(--coral)]"
                )}
              >
                {item.icon}
                {item.badge ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
