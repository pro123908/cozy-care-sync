import { outOfStockWhatsAppUrl, type Product } from "./data";
import { trackEngagementEvent } from "@/lib/meta-pixel";

/** "Contact on WhatsApp" for a product that is blocked while out of stock (opens a prefilled chat). */
export function contactOnWhatsApp(product: Pick<Product, "id" | "name">, source: string) {
  trackEngagementEvent("OutOfStockWhatsAppClick", {
    label: product.name,
    source,
    productIds: [product.id],
  });
  window.open(outOfStockWhatsAppUrl(product.name), "_blank", "noopener,noreferrer");
}
