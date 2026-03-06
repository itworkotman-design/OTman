// src/components/ServiceWindow.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceWindowItem, type ServiceWindowItemProps } from "./ServiceWindowItem";
import { ServiceModal } from "./ServiceModal";

export function ServiceWindow({
  title = "Book a service",
  items,
}: {
  title?: string;
  items: ServiceWindowItemProps[];
}) {
  const isCarousel = items.length > 1;

  const loopItems = useMemo(
    () => (isCarousel ? [...items, ...items, ...items] : items),
    [items, isCarousel]
  );
  const base = items.length;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const isTeleportingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getStride = () => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
    if (cards.length < 2) return 0;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  };

  const doInstant = (el: HTMLElement, fn: () => void) => {
    const cs = getComputedStyle(el) as CSSStyleDeclaration & Partial<{ scrollBehavior: string }>;
    const prevSnap = cs.scrollSnapType || "";
    const prevBehavior = cs.scrollBehavior ?? "";

    el.style.setProperty("scroll-snap-type", "none");
    el.style.setProperty("scroll-behavior", "auto");

    fn();

    requestAnimationFrame(() => {
      if (prevSnap) el.style.setProperty("scroll-snap-type", prevSnap);
      else el.style.removeProperty("scroll-snap-type");

      if (prevBehavior) el.style.setProperty("scroll-behavior", prevBehavior);
      else el.style.removeProperty("scroll-behavior");
    });
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isCarousel) return;

    requestAnimationFrame(() => {
      const stride = getStride();
      if (!stride) return;

      doInstant(el, () => {
        el.scrollLeft = stride * base;
      });
      setActive(0);
    });
  }, [base, isCarousel]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isCarousel) return;

    const handleScroll = () => {
      if (isTeleportingRef.current) return;

      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
      if (!cards.length) return;

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

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        const stride = getStride();
        if (!stride) return;

        if (bestIdx < base || bestIdx >= 2 * base) {
          const targetIdx = base + logical;
          const target = cards[targetIdx];
          if (!target) return;

          isTeleportingRef.current = true;
          doInstant(el, () => {
            const left = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
            el.scrollLeft = left;
          });
          requestAnimationFrame(() => {
            isTeleportingRef.current = false;
          });
        }
      }, 140);
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
    el.scrollTo({ left, behavior: "smooth" });
  };

  return (
    <>
      <section>
        <div className="w-full">
          <div className="p-4 rounded-2xl bg-logoblue">
            <h2 className="pb-4 lg:pb-0 text-center text-2xl font-bold text-white">{title}</h2>

            {/* MOBILE: centered carousel w/ peek + dots */}
            <div className="md:hidden">
              <div
                ref={scrollerRef}
                className="flex gap-6 overflow-x-auto snap-x snap-mandatory px-[10vw] overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {loopItems.map((item, idx) => (
                  <div key={`${item.title}-${idx}`} data-card className="shrink-0 snap-center">
                    <ServiceWindowItem
                      {...item}
                      onClick={() => setSelectedService(item.title)}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination dots */}
              {isCarousel && (
                <div className="flex items-center justify-center gap-2 pt-4">
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
            <div className="mt-4 hidden md:grid md:gap-6 grid-cols-3 lg:grid-cols-4 justify-items-center">
              {items.map((item) => (
                <ServiceWindowItem
                  key={item.title}
                  {...item}
                  onClick={() => setSelectedService(item.title)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedService && (
        <ServiceModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </>
  );
}