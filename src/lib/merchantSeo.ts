import { SITE_URL } from "./seo";

// Shipping and return terms for the Product JSON-LD `offers`, so Google can show them
// (and consider the products for free Shopping listings). They must match what the
// store really does, so they're built from the same numbers the checkout uses.
//
// Shipping: a flat Rs 250 unless the order reaches the free threshold. Checkout is
// free over Rs 2,000 in Karachi and over Rs 5,000 everywhere else; the markup only
// states the nationwide rule (Rs 5,000), so it never promises more than a shopper
// outside Karachi gets. Delivery is "3 to 5 working days" per the shipping policy.
// Returns (confirmed by the owner 2026-10-12): damaged or defective items, reported
// within 3 days of delivery. Who pays return shipping isn't stated anywhere, so
// `returnFees` is deliberately left out rather than guessed.

const FLAT_SHIPPING_RATE = 250;
const FREE_SHIPPING_FROM = 5000; // nationwide threshold (Karachi's lower Rs 2,000 is not claimed)
const RETURN_WINDOW_DAYS = 3;

export function buildOfferShippingDetails(price: number) {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: price >= FREE_SHIPPING_FROM ? 0 : FLAT_SHIPPING_RATE,
      currency: "PKR",
    },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 5, unitCode: "DAY" },
    },
  };
}

export function buildMerchantReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "PK",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: RETURN_WINDOW_DAYS,
    merchantReturnLink: `${SITE_URL}/policies`,
  };
}

/** The two extra fields to spread into a Product's `offers`. */
export function buildOfferPolicies(price: number) {
  return {
    shippingDetails: buildOfferShippingDetails(price),
    hasMerchantReturnPolicy: buildMerchantReturnPolicy(),
  };
}
