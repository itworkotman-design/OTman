// src/components/ServiceWindow.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ServiceWindowItem } from "./ServiceWindowItem";
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

const COMING_SOON = {
  en: { heading: "Coming soon", body: "We are still working on this feature. Please contact us for details." },
  no: { heading: "Kommer snart", body: "Vi jobber fortsatt med denne funksjonen. Ta kontakt med oss for detaljer." },
};

const NAV_MAP: Record<string, string> = {
  "manpower-rental": "manpower",
  "car-rental-services": "bil-utleie",
};

export function ServiceWindow({
  title,
  items,
  locale,
}: ServiceWindowProps) {
  const router = useRouter();
  const isCarousel = items.length > 1;

const localizedItems = useMemo(
  () =>
    items.map((item) => ({
      id: item.id,
      title: item.title[locale],
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
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  const handleItemClick = (id: string) => {
    const path = NAV_MAP[id];
    if (path) {
      router.push(`/${locale}/${path}`);
    } else {
      setComingSoonOpen(true);
    }
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
    const ro = firstCard ? new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      init();
      ro.disconnect();
    }) : null;
    ro?.observe(firstCard!);

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
      <section>
        <div className="w-full">
          <div className="p-4 rounded-2xl bg-logoblue">
            <h2 className="pb-4 lg:pb-0 text-center text-2xl font-bold text-white">
              {title[locale]}
            </h2>

            <div className="md:hidden">
              <div
                ref={scrollerRef}
                className="flex gap-6 overflow-x-auto snap-x snap-mandatory px-[calc(50%-120px)] overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {loopItems.map((item, idx) => (
                  <div key={`${item.title}-${idx}`} data-card className="shrink-0 snap-center">
                    <ServiceWindowItem
                      {...item}
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
                        i === active ? "bg-white" : "bg-white/40 hover:bg-white/60",
                      ].join(" ")}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 hidden justify-items-center md:grid md:grid-cols-4 md:gap-6">
              {items.map((item) => (
                <ServiceWindowItem
                  key={item.id}
                  title={item.title[locale]}
                  svg={item.svg}
                  onClick={() => handleItemClick(item.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {comingSoonOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.currentTarget === e.target) setComingSoonOpen(false); }}
        >
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-logoblue/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-logoblue">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h2 className="text-logoblue font-semibold text-xl">{COMING_SOON[locale].heading}</h2>
            <p className="text-textcolor text-sm leading-relaxed">{COMING_SOON[locale].body}</p>
            <button
              onClick={() => setComingSoonOpen(false)}
              className="customButtonEnabled h-10 px-6 mt-2"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
