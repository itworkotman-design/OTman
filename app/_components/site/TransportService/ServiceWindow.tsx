// src/components/ServiceWindow.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceWindowItem } from "./ServiceWindowItem";
import { ServiceModal } from "./ServiceModal";
import type {
  Locale,
  LocalizedText,
  ServiceGroup,
} from "@/lib/content/ServiceWindowContent";

type ServiceWindowProps = {
  title: LocalizedText;
  items: ServiceGroup[];
  locale: Locale;
};

export function ServiceWindow({
  title,
  items,
  locale,
}: ServiceWindowProps) {
  const isCarousel = items.length > 1;
  const badgeText = locale === "no" ? "Velg → " : "Select";

const localizedItems = useMemo(
  () =>
    items.map((item) => ({
      id: item.id,
      title: item.title[locale],
      description: item.modalIntro[locale],
      svg: item.svg,
    })),
  [items, locale]
);

  const loopItems = useMemo(
    () => (isCarousel ? [...localizedItems, ...localizedItems, ...localizedItems] : localizedItems),
    [localizedItems, isCarousel]
  );

  const base = localizedItems.length;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [activeModal, setActiveModal] = useState<ServiceGroup | null>(null);

  const handleItemClick = (id: string) => {
    // First three items open item 0's modal; the fourth opens item 1's modal.
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return;
    const modalItem = items[idx < 3 ? 0 : 1] ?? null;
    setActiveModal(modalItem);
  };

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

    let rafId: number;

    const init = () => {
      const stride = getStride();
      if (!stride) return;
      doInstant(el, () => { el.scrollLeft = stride * base; });
      setActive(0);
    };

    // Double RAF: first frame commits the render, second frame has layout
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(init);
    });

    // ResizeObserver fallback: fires once the cards have a measured width,
    // which guarantees getStride() will return a non-zero value
    const firstCard = el.querySelector<HTMLElement>("[data-card]");
    let ro: ResizeObserver | null = null;
    if (firstCard) {
      ro = new ResizeObserver(() => {
        cancelAnimationFrame(rafId);
        init();
        ro?.disconnect();
      });
      ro.observe(firstCard);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
    };
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
      <section aria-label={title[locale]}>
        <div className="w-full">
          <div className="md:hidden">
            <div
              ref={scrollerRef}
              className="flex gap-6 overflow-x-auto snap-x snap-mandatory px-[calc(50%-120px)] overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {loopItems.map((item, idx) => (
                <div key={`${item.title}-${idx}`} data-card className="shrink-0 snap-center">
                  <ServiceWindowItem
                    {...item}
                    badgeText={badgeText}
                    onClick={() => handleItemClick(item.id)}
                  />
                </div>
              ))}
            </div>

            {isCarousel && (
              <div className="flex items-center justify-center gap-2 pt-4">
                {localizedItems.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => scrollToLogical(i)}
                    className={[
                      "h-2 w-2 rounded-full transition",
                      i === active ? "bg-logoblue" : "bg-logoblue/30 hover:bg-logoblue/50",
                    ].join(" ")}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:flex md:flex-wrap md:justify-center md:gap-8">
            {items.map((item) => (
              <ServiceWindowItem
                key={item.id}
                title={item.title[locale]}
                description={item.modalIntro[locale]}
                svg={item.svg}
                badgeText={badgeText}
                onClick={() => handleItemClick(item.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {activeModal && (
        <ServiceModal
          service={activeModal}
          locale={locale}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}
