import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useWcm, useProductRatings } from "./context";
import {
  PKR,
  getProductSeoPathSegment,
  getSelectableOptions,
  getUnitPrice,
  isOutOfStockBlocked,
  type Product,
} from "./data";
import { Icons } from "./icons";
import { Btn, ProductImage, ProductPhoto, Stars } from "./ui";
import { gaEvent } from "@/lib/ga";
import { trackQuickView } from "@/lib/meta-pixel";
import { CompareToggleButton } from "./compare";
import { contactOnWhatsApp } from "./out-of-stock";

const MAX_QTY = 5;

function Gallery({ product, optionImage }: { product: Product; optionImage: string | null }) {
  const images = useMemo(() => {
    const all = [
      optionImage,
      product.image_url,
      ...(Array.isArray(product.gallery_images) ? product.gallery_images : []),
    ].filter((src): src is string => Boolean(src));
    return Array.from(new Set(all)).slice(0, 6);
  }, [product, optionImage]);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [optionImage, product.id]);

  if (images.length === 0) return <ProductImage product={product} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ProductPhoto
        src={images[Math.min(index, images.length - 1)]}
        alt={product.name}
        loading="eager"
        className="wcm-qv-photo"
        containerStyle={{
          width: "100%",
          aspectRatio: "1/1",
          borderRadius: 12,
          background: "var(--chip-2)",
        }}
      />
      {images.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              style={{
                flex: "0 0 auto",
                width: 52,
                height: 52,
                padding: 0,
                borderRadius: 8,
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--chip-2)",
                border: `2px solid ${i === index ? "var(--blue-500)" : "var(--line)"}`,
              }}
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickViewDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { products, addToCart } = useWcm();
  const navigate = useNavigate();
  const getProductRatings = useProductRatings();
  const { average, count } = getProductRatings(product.id);

  const options = getSelectableOptions(product);
  const [selected, setSelected] = useState<string | undefined>(options[0]?.label);
  const [qty, setQty] = useState(1);

  const blocked = isOutOfStockBlocked(product);
  const unitPrice = getUnitPrice(product, selected);
  const optionImage = options.find((o) => o.label === selected)?.imageUrl ?? null;
  const rating = Number(average || product.rating || 0);
  const reviewCount = count || product.reviews;
  const features = (product.features ?? []).filter(Boolean).slice(0, 4);
  const discount =
    product.was && product.was > product.price
      ? Math.round((1 - product.price / product.was) * 100)
      : 0;

  useEffect(() => {
    gaEvent("quick_view", { item_id: product.id, item_name: product.name });
  }, [product.id, product.name]);

  const openFull = () => {
    trackQuickView("QuickViewDetailsClick", product);
    onClose();
    navigate({
      to: "/products/$productId",
      params: { productId: getProductSeoPathSegment(product, products) },
    });
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="wcm-qv-overlay" />
        <DialogPrimitive.Content
          className="wcm-qv-content"
          aria-describedby={undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <DialogPrimitive.Close className="wcm-qv-close" aria-label="Close quick view">
            {Icons.close}
          </DialogPrimitive.Close>
          <div className="wcm-qv-grid">
            <Gallery product={product} optionImage={optionImage} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              {product.brand ? (
                <span
                  style={{
                    alignSelf: "flex-start",
                    padding: "2px 10px",
                    borderRadius: 999,
                    background: "var(--chip-2)",
                    border: "1px solid var(--line)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink-3)",
                    textTransform: "capitalize",
                  }}
                >
                  {product.brand}
                </span>
              ) : null}
              <DialogPrimitive.Title
                style={{
                  margin: 0,
                  paddingRight: 28,
                  fontSize: 19,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  letterSpacing: -0.3,
                  color: "var(--ink)",
                }}
              >
                {product.name}
              </DialogPrimitive.Title>
              {reviewCount > 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "var(--ink-4)",
                  }}
                >
                  <Stars value={rating} size={13} showNum={false} />
                  <span style={{ fontWeight: 700 }}>{rating.toFixed(1)}</span>
                  <span>· {reviewCount} reviews</span>
                </div>
              ) : null}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: "var(--ink)" }}>
                  {PKR(unitPrice)}
                </span>
                {product.was && options.length === 0 ? (
                  <span
                    style={{ fontSize: 14, color: "var(--ink-4)", textDecoration: "line-through" }}
                  >
                    {PKR(product.was)}
                  </span>
                ) : null}
                {discount > 0 && options.length === 0 ? (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "var(--pill-rose-bg)",
                      color: "var(--pill-rose-fg)",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    -{discount}%
                  </span>
                ) : null}
              </div>

              {features.length > 0 ? (
                <ul
                  style={{
                    margin: 0,
                    padding: "10px 12px",
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    background: "var(--chip-2)",
                    borderRadius: 10,
                    fontSize: 13.5,
                    color: "var(--ink-2)",
                  }}
                >
                  {features.map((f) => (
                    <li key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span
                        aria-hidden="true"
                        style={{ color: "var(--pill-success-fg)", flexShrink: 0, display: "flex" }}
                      >
                        {Icons.check}
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : product.blurb ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: "var(--ink-3)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {product.blurb}
                </p>
              ) : null}

              {options.length > 0 ? (
                <div
                  role="radiogroup"
                  aria-label="Choose an option"
                  style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                >
                  {options.map((opt) => {
                    const active = opt.label === selected;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelected(opt.label)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 10,
                          fontFamily: "inherit",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          color: "var(--ink)",
                          background: active ? "var(--pill-teal-bg)" : "var(--card)",
                          border: `1px solid ${active ? "var(--pill-teal-fg)" : "var(--line)"}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    border: "1px solid var(--line)",
                    borderRadius: 11,
                    background: "var(--card)",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                    style={stepStyle}
                  >
                    {Icons.minus}
                  </button>
                  <span
                    aria-live="polite"
                    style={{ minWidth: 26, textAlign: "center", fontWeight: 800, fontSize: 14 }}
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                    disabled={qty >= MAX_QTY}
                    aria-label="Increase quantity"
                    style={stepStyle}
                  >
                    {Icons.plus}
                  </button>
                </div>
                <Btn
                  full
                  icon={blocked ? Icons.whatsapp : Icons.cart}
                  onClick={() => {
                    if (blocked) {
                      contactOnWhatsApp(product, "quick view");
                      return;
                    }
                    trackQuickView("QuickViewAddToCart", product);
                    addToCart(product, qty, selected);
                    onClose();
                  }}
                >
                  {blocked ? "Contact on WhatsApp" : "Add to cart"}
                </Btn>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <CompareToggleButton product={product} variant="text" />
                <button
                  type="button"
                  onClick={openFull}
                  style={{
                    alignSelf: "flex-start",
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--blue-700)",
                  }}
                >
                  View full details
                </button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const stepStyle: React.CSSProperties = {
  width: 34,
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: "var(--ink-3)",
  cursor: "pointer",
};
