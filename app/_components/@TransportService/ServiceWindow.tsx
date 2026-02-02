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
  const loopItems = useMemo(() => (isCarousel ? [...items, ...items, ...items] : items), [items, isCarousel]);
  const base = items.length; // size of one copy

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // Jump to the middle copy on mount so you can scroll both ways.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isCarousel) return;

    // Wait a tick so layout is measured
    requestAnimationFrame(() => {
      const firstCard = el.querySelector<HTMLElement>("[data-card]");
      if (!firstCard) return;

      const cardW = firstCard.offsetWidth;
      const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || "0") || 0;

      // index = base (first item of middle copy)
      el.scrollLeft = (cardW + gap) * base;
      setActive(0);
    });
  }, [base, isCarousel]);

  // Update active dot + keep "infinite" by teleporting when near edges.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isCarousel) return;

    const onScroll = () => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
      if (!cards.length) return;

      const center = el.scrollLeft + el.clientWidth / 2;

      // Find closest card to center
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
      setActive(logical);

      // Teleport logic: if you drift into the first/last copy, jump back to middle same logical item.
      // This keeps scrolling "infinite" without visible jump.
      if (bestIdx < base * 0.5 || bestIdx > base * 2.5) {
        const targetIdx = base + logical; // same item in middle copy
        const target = cards[targetIdx];
        if (target) {
          // keep same visual center
          const targetLeft = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
          el.scrollLeft = targetLeft;
        }
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    }, [base, isCarousel]);

  const scrollToLogical = (logicalIndex: number) => {
    const el = scrollerRef.current;
    if (!el) return;

    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
    if (!cards.length) return;

    const targetIdx = isCarousel ? base + logicalIndex : logicalIndex;
    const target = cards[targetIdx];
    if (!target) return;

    const left = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
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
                [-ms-overflow-style:none] [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
              "
            >
              {loopItems.map((item, idx) => (
                <div
                  key={`${item.href}-${idx}`}
                  data-card
                  className="shrink-0 snap-center"
                >
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
