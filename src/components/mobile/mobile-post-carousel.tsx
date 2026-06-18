"use client";

import { Heart } from "lucide-react";
import { type PointerEvent, useMemo, useRef, useState } from "react";
import type { MobileMediaAsset } from "@/lib/mobile-types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function MediaSurface({
  alt,
  className,
  item
}: {
  alt: string;
  className: string;
  item: MobileMediaAsset;
}) {
  if (item.mimeType.startsWith("video/")) {
    return (
      <video className={className} controls playsInline muted preload="metadata">
        <source src={item.previewUrl ?? ""} type={item.mimeType} />
      </video>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={item.previewUrl ?? ""} loading="lazy" decoding="async" />
  );
}

export function MobilePostCarousel({
  aspectClassName,
  className,
  items,
  label,
  onDoubleLike
}: {
  aspectClassName: string;
  className?: string;
  items: MobileMediaAsset[];
  label: string;
  onDoubleLike?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [heartBurstKey, setHeartBurstKey] = useState(0);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const normalizedItems = useMemo(() => items.filter((item) => Boolean(item.previewUrl)), [items]);

  const handleTap = (clientX: number, clientY: number) => {
    const now = Date.now();
    const previousTap = lastTapRef.current;

    if (
      previousTap &&
      now - previousTap.time < 320 &&
      Math.abs(previousTap.x - clientX) < 28 &&
      Math.abs(previousTap.y - clientY) < 28
    ) {
      lastTapRef.current = null;
      setHeartBurstKey((current) => current + 1);
      onDoubleLike?.();
      return;
    }

    lastTapRef.current = { time: now, x: clientX, y: clientY };
  };

  const interactionProps = {
    onPointerCancel: () => {
      pointerStartRef.current = null;
    },
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const pointerStart = pointerStartRef.current;
      pointerStartRef.current = null;

      if (
        pointerStart &&
        (Math.abs(event.clientX - pointerStart.x) > 16 || Math.abs(event.clientY - pointerStart.y) > 16)
      ) {
        return;
      }

      handleTap(event.clientX, event.clientY);
    }
  };

  if (!normalizedItems.length) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-[var(--bg-soft)] text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]",
          aspectClassName,
          className
        )}
      >
        Sin foto
      </div>
    );
  }

  if (normalizedItems.length === 1) {
    return (
      <div
        {...interactionProps}
        className={cn("relative overflow-hidden touch-manipulation", className)}
      >
        <MediaSurface
          alt={label}
          className={cn("w-full object-cover", aspectClassName)}
          item={normalizedItems[0]!}
        />
        {heartBurstKey > 0 ? (
          <span
            key={heartBurstKey}
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ animation: "mobile-like-burst 820ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
          >
            <Heart className="h-24 w-24 fill-[#ff4f88] text-[#ff4f88] drop-shadow-[0_20px_28px_rgba(0,0,0,0.28)]" />
          </span>
        ) : null}
        <style jsx>{`
          @keyframes mobile-like-burst {
            0% {
              opacity: 0;
              transform: translate(-50%, -46%) scale(0.4);
            }
            18% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.08);
            }
            58% {
              opacity: 1;
              transform: translate(-50%, -58%) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -96%) scale(1.12);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      {...interactionProps}
      className={cn("relative overflow-hidden bg-black touch-manipulation", className)}
    >
      <div
        className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(event) => {
          const node = event.currentTarget;
          const width = node.clientWidth || 1;
          setActiveIndex(Math.round(node.scrollLeft / width));
        }}
      >
        {normalizedItems.map((item, index) => (
          <div key={item.id} className="w-full shrink-0 snap-center">
            <MediaSurface
              alt={`${label} ${index + 1}`}
              className={cn("w-full object-cover", aspectClassName)}
              item={item}
            />
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
        {activeIndex + 1}/{normalizedItems.length}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
        {normalizedItems.map((item, index) => (
          <span
            key={item.id}
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-white/45 transition-all",
              index === activeIndex && "w-5 bg-white"
            )}
          />
        ))}
      </div>

      {heartBurstKey > 0 ? (
        <span
          key={heartBurstKey}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ animation: "mobile-like-burst 820ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
        >
          <Heart className="h-24 w-24 fill-[#ff4f88] text-[#ff4f88] drop-shadow-[0_20px_28px_rgba(0,0,0,0.28)]" />
        </span>
      ) : null}

      <style jsx>{`
        @keyframes mobile-like-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, -46%) scale(0.4);
          }
          18% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.08);
          }
          58% {
            opacity: 1;
            transform: translate(-50%, -58%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -96%) scale(1.12);
          }
        }
      `}</style>
    </div>
  );
}
