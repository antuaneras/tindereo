"use client";

import { useMemo, useRef, useState } from "react";
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
    <img alt={alt} className={className} src={item.previewUrl ?? ""} />
  );
}

export function MobilePostCarousel({
  aspectClassName,
  className,
  items,
  label
}: {
  aspectClassName: string;
  className?: string;
  items: MobileMediaAsset[];
  label: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedItems = useMemo(() => items.filter((item) => Boolean(item.previewUrl)), [items]);

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
      <div className={cn("relative overflow-hidden", className)}>
        <MediaSurface alt={label} className={cn("w-full object-cover", aspectClassName)} item={normalizedItems[0]!} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      <div
        ref={trackRef}
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
    </div>
  );
}
