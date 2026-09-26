"use client";
/**
 * Motion primitives. They only toggle data attributes and CSS custom properties;
 * every timing, easing and keyframe lives in src/app/styles/motion.css so the
 * whole system can be tuned (or switched off) from one stylesheet.
 *
 * All of it degrades to static, fully visible content when JavaScript is off
 * or the visitor prefers reduced motion.
 */
import Link from "next/link";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

type RevealTag = "div" | "section" | "li" | "p" | "span" | "h2" | "h3" | "figure";

export function useInView<T extends Element>({
  once = true,
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.12,
}: { once?: boolean; rootMargin?: string; threshold?: number } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin, threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);
  return [ref, inView] as const;
}

/**
 * Plays a one-time entrance when the element scrolls into view.
 * variant: "rise" (default), "fade", "mask" (clip-path wipe), "words" (use with <SplitWords>).
 */
export function Reveal({
  as = "div",
  variant = "rise",
  delay = 0,
  className,
  style,
  children,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  as?: RevealTag;
  variant?: "rise" | "fade" | "mask" | "words";
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      id={id}
      className={className}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-reveal={variant}
      data-inview={inView ? "" : undefined}
      style={{ ...style, ["--reveal-delay" as string]: delay + "ms" }}
    >
      {children}
    </Tag>
  );
}

/**
 * Splits a line of text into masked words that rise into place.
 * Screen readers still read one continuous string.
 * Put it inside <Reveal variant="words"> for scroll-triggered text, or inside
 * an element with the `.load-words` class to play on first paint.
 */
export function SplitWords({ text, offset = 0 }: { text: string; offset?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={index}>
          <span className="word-mask">
            <span className="word" style={{ ["--i" as string]: index + offset }}>
              {word}
            </span>
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

export type PreviewItem = {
  href: string;
  title: string;
  line: string;
  photo: string;
  meta?: string;
};

/**
 * An index of large links. On devices with a mouse, a framed photo follows the
 * pointer and swaps as you move between rows. On touch devices each row shows
 * its own thumbnail instead, so nothing depends on hover.
 */
export function PreviewList({ items, label }: { items: PreviewItem[]; label: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  function place(x: number, y: number) {
    const element = listRef.current;
    if (!element) return;
    element.style.setProperty("--px", x + "px");
    element.style.setProperty("--py", y + "px");
  }
  /** Centre of the empty lane reserved between title and description. */
  function laneX(bounds: DOMRect) {
    const slot = listRef.current?.querySelector(".preview-slot");
    if (!slot) return bounds.width * 0.5;
    const rect = slot.getBoundingClientRect();
    return rect.left - bounds.left + rect.width / 2;
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !listRef.current) return;
    const bounds = listRef.current.getBoundingClientRect(),
      lane = laneX(bounds),
      pointerX = event.clientX - bounds.left;
    // Track the pointer vertically; drift only slightly sideways so text stays clear.
    place(lane + (pointerX - lane) * 0.08, event.clientY - bounds.top);
  }
  function onFocusRow(index: number, target: HTMLElement) {
    const list = listRef.current;
    if (!list) return;
    const bounds = list.getBoundingClientRect(),
      row = target.getBoundingClientRect();
    place(laneX(bounds), row.top - bounds.top + row.height / 2);
    setActive(index);
  }

  return (
    <div
      ref={listRef}
      className="preview-list"
      data-active={active === null ? undefined : ""}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setActive(null)}
    >
      <ul aria-label={label}>
        {items.map((item, index) => (
          <li key={item.href} style={{ ["--i" as string]: index }}>
            <Link
              href={item.href}
              className={"preview-row" + (active === index ? " is-active" : "")}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setActive(index);
              }}
              onFocus={(event) => onFocusRow(index, event.currentTarget)}
              onBlur={() => setActive(null)}
            >
              <img className="preview-thumb" src={item.photo} alt="" loading="lazy" />
              <span className="preview-title">{item.title}</span>
              <span className="preview-slot" aria-hidden="true" />
              <span className="preview-line">{item.line}</span>
              {item.meta && <span className="preview-meta">{item.meta}</span>}
              <svg
                className="preview-arrow"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                aria-hidden="true"
              >
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
      <div className="preview-float" aria-hidden="true">
        {items.map((item, index) => (
          <img
            key={item.href}
            src={item.photo}
            alt=""
            loading="lazy"
            className={active === index ? "is-on" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
