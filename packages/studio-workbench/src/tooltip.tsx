import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipSide = "top" | "right" | "bottom" | "left";

interface TooltipContextValue {
  delay: () => number;
  markClosed: () => void;
}

const TooltipContext = createContext<TooltipContextValue | undefined>(undefined);

export function tooltipDelay(lastClosedAt: number, now: number): number {
  return now - lastClosedAt <= 500 ? 80 : 300;
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  const lastClosedAt = useRef(Number.NEGATIVE_INFINITY);
  const delay = useCallback(() => tooltipDelay(lastClosedAt.current, performance.now()), []);
  const markClosed = useCallback(() => { lastClosedAt.current = performance.now(); }, []);
  const value = useMemo<TooltipContextValue>(() => ({ delay, markClosed }), [delay, markClosed]);
  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
}

function positionFor(rect: DOMRect, side: TooltipSide): { left: number; top: number; transform: string } {
  if (side === "right") return rect.right + 208 <= window.innerWidth
    ? { left: rect.right + 8, top: rect.top + rect.height / 2, transform: "translateY(-50%)" }
    : { left: rect.left - 8, top: rect.top + rect.height / 2, transform: "translate(-100%, -50%)" };
  if (side === "left") return rect.left >= 208
    ? { left: rect.left - 8, top: rect.top + rect.height / 2, transform: "translate(-100%, -50%)" }
    : { left: rect.right + 8, top: rect.top + rect.height / 2, transform: "translateY(-50%)" };
  const center = Math.max(108, Math.min(window.innerWidth - 108, rect.left + rect.width / 2));
  if (side === "top" && rect.top >= 42) return { left: center, top: rect.top - 8, transform: "translate(-50%, -100%)" };
  return { left: center, top: rect.bottom + 8, transform: "translateX(-50%)" };
}

export function Tooltip({ content, side = "bottom", children }: { content: ReactNode; side?: TooltipSide; children: ReactNode }) {
  const context = useContext(TooltipContext);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; transform: string }>();
  const id = useId();

  const close = useCallback((): void => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setOpen((wasOpen) => { if (wasOpen) context?.markClosed(); return false; });
  }, [context]);

  const scheduleOpen = useCallback((): void => {
    if (timerRef.current !== undefined || open) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(positionFor(rect, side));
      setOpen(true);
    }, context?.delay() ?? 300);
  }, [context, open, side]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event): void => { if (event instanceof KeyboardEvent && event.key !== "Escape") return; close(); };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("dragstart", dismiss);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("dragstart", dismiss);
    };
  }, [close, open]);

  useEffect(() => close, [close]);

  return <span ref={anchorRef} className="wb-tooltip-anchor" onPointerEnter={scheduleOpen} onPointerLeave={close} onFocusCapture={scheduleOpen} onBlurCapture={close} aria-describedby={open ? id : undefined}>
    {children}
    {open && position ? createPortal(<span id={id} role="tooltip" className={`wb-tooltip wb-tooltip--${side}`} style={position}>{content}</span>, document.body) : null}
  </span>;
}
