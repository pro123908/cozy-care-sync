import { useEffect } from "react";

// "Add to cart" feedback: a small thumbnail flies from the button that was tapped to
// the cart icon, which then bumps. It piggybacks on one `wcm:cart-add` window event
// fired by addToCart, plus a capture-phase click listener that remembers where the
// last click happened, so no individual add button needs wiring.
//
// The cart icon marks itself with `data-cart-target` (header icon on desktop, bottom-bar
// tab on mobile); the visible one wins. The listener sets `detail.handled` when it runs
// so addToCart can delay opening the drawer until the thumbnail has landed.

export const CART_ADD_EVENT = "wcm:cart-add";
export const CART_FLY_MS = 520;

export type CartAddDetail = { image?: string | null; handled?: boolean };

const SIZE = 44;
let lastClick: { x: number; y: number; at: number } | null = null;

function visibleCartTarget(): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function bump(target: HTMLElement) {
  target.classList.remove("wcm-cart-bump");
  void target.offsetWidth; // restart the animation if it is already running
  target.classList.add("wcm-cart-bump");
  window.setTimeout(() => target.classList.remove("wcm-cart-bump"), 450);
}

function fly(detail: CartAddDetail) {
  const target = visibleCartTarget();
  if (!target || !lastClick || Date.now() - lastClick.at > 1500) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const end = target.getBoundingClientRect();
  const sx = lastClick.x;
  const sy = lastClick.y;
  const ex = end.left + end.width / 2;
  const ey = end.top + end.height / 2;
  // Arc through a point above the straight line so it reads as a toss, not a slide.
  const mx = (sx + ex) / 2;
  const my = Math.min(sy, ey) - 70;
  const half = SIZE / 2;

  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 6px 16px rgba(15,23,42,.35)",
    background: detail.image
      ? `center / cover no-repeat url("${detail.image.replace(/"/g, "%22")}")`
      : "var(--grad, #16a34a)",
    zIndex: "400",
    pointerEvents: "none",
    willChange: "transform, opacity",
  });
  document.body.appendChild(dot);

  detail.handled = true;
  const animation = dot.animate(
    [
      { transform: `translate(${sx - half}px, ${sy - half}px) scale(1)`, opacity: 1 },
      {
        transform: `translate(${mx - half}px, ${my - half}px) scale(0.8)`,
        opacity: 1,
        offset: 0.5,
      },
      { transform: `translate(${ex - half}px, ${ey - half}px) scale(0.3)`, opacity: 0.5 },
    ],
    { duration: CART_FLY_MS, easing: "cubic-bezier(.4,.1,.3,1)", fill: "forwards" },
  );
  const done = () => {
    dot.remove();
    bump(target);
  };
  animation.onfinish = done;
  animation.oncancel = () => dot.remove();
}

export function CartFlyer() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Mouse/touch click: use the pressed control's centre. Keyboard "click" has no
      // position (detail 0), the focused control's centre works there too.
      const el = (e.target as HTMLElement | null)?.closest?.(
        "button, a, [role='button']",
      ) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0)
        lastClick = { x: r.left + r.width / 2, y: r.top + r.height / 2, at: Date.now() };
      else if (e.clientX || e.clientY) lastClick = { x: e.clientX, y: e.clientY, at: Date.now() };
    };
    const onAdd = (e: Event) => fly((e as CustomEvent<CartAddDetail>).detail ?? {});
    window.addEventListener("click", onClick, true);
    window.addEventListener(CART_ADD_EVENT, onAdd);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener(CART_ADD_EVENT, onAdd);
    };
  }, []);
  return null;
}
