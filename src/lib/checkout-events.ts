// "InitiateCheckout" (Meta) + "begin_checkout" (Google Analytics), fired the
// moment a shopper CLICKS a button that sends them to checkout — the cart
// drawer's Checkout button and the bundle page's "Order now". It used to fire
// whenever the /checkout page loaded, which also counted reloads, back/forward
// returns and direct visits (one shopper could produce several events).
import { getUnitPrice, type Product } from "@/wcm/data";
import { trackMetaEvent, toMetaValue, uniqueContentIds } from "@/lib/meta-pixel";

export type CheckoutClickItem = {
  id?: string;
  qty?: number;
  size?: string;
  unit_price?: number;
  p?: Product;
};

export function trackCheckoutClick(items: CheckoutClickItem[], total: number, email?: string) {
  if (items.length === 0) return;

  const lines = items.map((item) => ({
    id: item.p?.id || item.id || "",
    quantity: Math.max(1, Number(item.qty) || 1),
    price: Number(item.unit_price ?? (item.p ? getUnitPrice(item.p, item.size) : 0)),
    item,
  }));

  trackMetaEvent(
    "InitiateCheckout",
    {
      content_ids: uniqueContentIds(lines.map((l) => l.id)),
      content_type: "product",
      num_items: lines.reduce((sum, l) => sum + l.quantity, 0),
      contents: lines.map((l) => ({ id: l.id, quantity: l.quantity, item_price: toMetaValue(l.price) })),
      value: toMetaValue(total),
      currency: "PKR",
    },
    { userData: { email } },
  );

}
