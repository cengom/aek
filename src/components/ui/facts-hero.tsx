"use client";

/**
 * FactsHero — 21st.dev bileşeninden uyarlandı.
 * - Renkler "Sakin Altın" paletine çevrildi (lacivert zemin → antrasit, turuncu → altın, mavi vurgu → bal/bronz).
 * - Site genelindeki <LazyMotion strict> nedeniyle `motion.*` yerine `m.*` kullanılır.
 * - "Hareketi azalt" tercihinde rakamlar dönmeden doğrudan gösterilir.
 */
import * as React from "react";
import { m, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

function Reel({ digit, lh, delay, on }: { digit: number; lh: number; delay: number; on: boolean }) {
  return (
    <span className="inline-block overflow-hidden align-top" style={{ height: lh }}>
      <m.span
        className="flex flex-col"
        initial={{ y: 0 }}
        animate={on ? { y: -digit * lh } : undefined}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay }}
      >
        {Array.from({ length: 10 }).map((_, d) => (
          <span key={d} className="block" style={{ height: lh, lineHeight: `${lh}px` }}>
            {d}
          </span>
        ))}
      </m.span>
    </span>
  );
}

function Rolling({ text, delay, on }: { text: string; delay: number; on: boolean }) {
  const lh = 18;
  return (
    <span className="inline-flex tabular-nums" style={{ height: lh, lineHeight: `${lh}px` }} role="img" aria-label={text}>
      <span aria-hidden className="inline-flex select-none">
        {text.split("").map((c, i) =>
          /\d/.test(c) ? <Reel key={i} digit={Number(c)} lh={lh} delay={delay + i * 0.06} on={on} /> : <span key={i}>{c}</span>,
        )}
      </span>
    </span>
  );
}

export interface Fact {
  label: string;
  value: string;
  /** değerdeki rakamları döndürerek göster */
  roll?: boolean;
  highlight?: boolean;
}

type Action = { label: string; href: string };

export interface FactsHeroProps {
  title: React.ReactNode;
  body: string;
  primary?: Action;
  secondary?: Action;
  image: string;
  imageAlt?: string;
  cardTitle?: string;
  cardMeta?: string;
  facts: Fact[];
  className?: string;
}

const ease = [0.42, 0, 0, 1] as const;

export function FactsHero({
  title,
  body,
  primary,
  secondary,
  image,
  imageAlt = "",
  cardTitle = "At a glance",
  cardMeta,
  facts,
  className,
}: FactsHeroProps) {
  const ref = React.useRef<HTMLElement>(null);
  const on = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();

  return (
    <section ref={ref} className={cn("w-full bg-ink px-4 pb-4 pt-16 md:px-6 md:pb-6 md:pt-24", className)}>
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-[880px] px-1 md:px-10">
          <m.h1
            className="font-serif text-[clamp(40px,5.2vw,76px)] font-light leading-[1.05] tracking-[-0.02em] text-ivory"
            initial={{ opacity: 0, y: 30 }}
            animate={on ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 1, ease }}
          >
            {title}
          </m.h1>
          <m.p
            className="mt-6 max-w-[50ch] text-[17px] leading-relaxed text-ivory/75 md:text-lead"
            initial={{ opacity: 0, y: 20 }}
            animate={on ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 1, ease, delay: 0.12 }}
          >
            {body}
          </m.p>
          <m.div
            className="mt-9 flex flex-wrap gap-3"
            initial={{ opacity: 0 }}
            animate={on ? { opacity: 1 } : undefined}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {primary && (
              <a href={primary.href} className="btn rounded-full bg-gold px-6 text-ink hover:bg-[#d4b062]">
                {primary.label}
              </a>
            )}
            {secondary && (
              <a href={secondary.href} className="btn rounded-full border border-ivory/25 px-6 text-ivory hover:border-ivory/60">
                {secondary.label}
              </a>
            )}
          </m.div>
        </div>

        <m.div
          className="relative mt-14 overflow-hidden rounded-[12px] bg-[#2a2d34] md:mt-20"
          initial={{ opacity: 0, y: 60 }}
          animate={on ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1.1, ease, delay: 0.2 }}
        >
          <m.img
            src={image}
            alt={imageAlt}
            fetchPriority="high"
            decoding="async"
            className="aspect-[4/5] w-full object-cover md:aspect-[16/8]"
            initial={{ scale: 1.12 }}
            animate={on ? { scale: 1 } : undefined}
            transition={{ duration: 1.8, ease }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent md:bg-gradient-to-l md:from-ink/40" />

          <m.div
            className="absolute inset-x-3 bottom-3 rounded-[10px] border border-ivory/25 bg-ivory/10 p-1.5 backdrop-blur-xl md:inset-x-auto md:bottom-auto md:right-8 md:top-1/2 md:w-[420px] md:-translate-y-1/2"
            initial={{ opacity: 0, x: 40 }}
            animate={on ? { opacity: 1, x: 0 } : undefined}
            transition={{ duration: 1, ease, delay: 0.7 }}
          >
            <div className="rounded-[7px] bg-paper">
              <div className="flex items-center justify-between px-4 py-3 text-[14px]">
                <span className="font-medium text-ink">{cardTitle}</span>
                {cardMeta && <span className="text-ink-muted">{cardMeta}</span>}
              </div>
              <ul>
                {facts.map((f, i) => (
                  <m.li
                    key={f.label}
                    className="flex items-center justify-between gap-4 border-t border-line px-4 py-[11px] text-[13px]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={on ? { opacity: 1, y: 0 } : undefined}
                    transition={{ duration: 0.6, ease, delay: 0.95 + i * 0.07 }}
                  >
                    <span className="text-ink-muted">{f.label}</span>
                    <span className={cn("text-right text-ink", f.highlight && "rounded-[4px] bg-honey-soft px-1.5 py-0.5 text-[#6b4e10]")}>
                      {f.roll && !reduce ? <Rolling text={f.value} delay={1.1 + i * 0.07} on={on} /> : f.value}
                    </span>
                  </m.li>
                ))}
              </ul>
            </div>
          </m.div>
        </m.div>
      </div>
    </section>
  );
}

export default FactsHero;
