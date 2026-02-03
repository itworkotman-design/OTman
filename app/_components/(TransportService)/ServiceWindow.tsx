// src/components/ServiceWindow.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceWindowItem, type ServiceWindowItemProps } from "./ServiceWindowItem";

export function ServiceWindow({
  title = "Book a service",
  items,
}: {
  title?: string;
  items: ServiceWindowItemProps[];
}) {
  const isCarousel = items.length > 1;

  // Build 3 copies for "infinite" feel; we start in the middle copy.
  const loopItems = useMemo(
    () => (isCarousel ? [...items, ...items, ...items] : items),
    [items, isCarousel]
  );
  const base = items.length; // size of one copy

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // Control flags/timers
  const isTeleportingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: compute stride between adjacent cards from DOM (handles gap + padding)
  const getStride = () => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
    if (cards.length < 2) return 0;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  };

  // Helper: run a scrollLeft change with snap & smooth disabled for one frame (no `any`)
  const doInstant = (el: HTMLElement, fn: () => void) => {
    const cs = getComputedStyle(el) as CSSStyleDeclaration & Partial<{ scrollBehavior: string }>;
    const prevSnap = cs.scrollSnapType || "";
    const prevBehavior = cs.scrollBehavior ?? "";

    // Disable snapping & smoothing just for this operation
    el.style.setProperty("scroll-snap-type", "none");
    el.style.setProperty("scroll-behavior", "auto");

    fn();

    requestAnimationFrame(() => {
      // Restore previous values (or clear inline overrides)
      if (prevSnap) el.style.setProperty("scroll-snap-type", prevSnap);
      else el.style.removeProperty("scroll-snap-type");

      if (prevBehavior) el.style.setProperty("scroll-behavior", prevBehavior);
      else el.style.removeProperty("scroll-behavior");
    });
  };

  // Jump to the middle copy on mount so you can scroll both ways.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isCarousel) return;

    requestAnimationFrame(() => {
      const stride = getStride();
      if (!stride) return;

      // index = base (first item of middle copy)
      doInstant(el, () => {
        el.scrollLeft = stride * base;
      });
      setActive(0);
    });
  }, [base, isCarousel]);

  // Update active dot; teleport back to middle copy only AFTER scrolling goes idle.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isCarousel) return;

    const handleScroll = () => {
      if (isTeleportingRef.current) return;

      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
      if (!cards.length) return;

      // Find closest card to the visual center
      const center = el.scrollLeft + el.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const cCenter = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(cCenter - center);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      const logical = ((bestIdx % base) + base) % base;
      if (logical !== active) setActive(logical);

      // Restart idle debounce
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        const stride = getStride();
        if (!stride) return;

        // Middle copy is [base, 2*base). Teleport only if outside.
        if (bestIdx < base || bestIdx >= 2 * base) {
          const targetIdx = base + logical; // same item in middle copy
          const target = cards[targetIdx];
          if (!target) return;

          isTeleportingRef.current = true;
          doInstant(el, () => {
            const left = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
            el.scrollLeft = left;
          });
          // let layout settle one frame
          requestAnimationFrame(() => {
            isTeleportingRef.current = false;
          });
        }
      }, 140); // tweakable: higher = more conservative, fewer teleports during momentum
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [active, base, isCarousel]);

  const scrollToLogical = (logicalIndex: number) => {
    const el = scrollerRef.current;
    if (!el) return;

    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
    if (!cards.length) return;

    const targetIdx = isCarousel ? base + logicalIndex : logicalIndex;
    const target = cards[targetIdx];
    if (!target) return;

    const left = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
    // user-initiated programmatic scroll should be smooth
    el.scrollTo({ left, behavior: "smooth" });
  };

  return (
    <section>
      <div className="w-full">
        <div className="rounded-2xl bg-logoblue p-4 shadow-sm">
          <h2 className="text-center text-2xl font-bold text-white">{title}</h2>

          {/* MOBILE: centered carousel w/ peek + dots */}
          <div className="mt-6 md:hidden">
            <div
              ref={scrollerRef}
              className="
                flex gap-6 overflow-x-auto pb-4
                snap-x snap-mandatory
                px-[10vw]
                overscroll-x-contain
                [-ms-overflow-style:none] [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
              "
            >
              {loopItems.map((item, idx) => (
                <div key={`${item.href}-${idx}`} data-card className="shrink-0 snap-center">
                  <ServiceWindowItem {...item} />
                </div>
              ))}
            </div>

            {/* Pagination dots */}
            {isCarousel && (
              <div className="mt-3 flex items-center justify-center gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => scrollToLogical(i)}
                    className={[
                      "h-2 w-2 rounded-full transition",
                      i === active ? "bg-white" : "bg-white/40 hover:bg-white/60",
                    ].join(" ")}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SM+ : grid */}
          <div className="mt-6 hidden md:grid md:gap-6 grid-cols-3 lg:grid-cols-4 justify-items-center">
            {items.map((item) => (
              <ServiceWindowItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
