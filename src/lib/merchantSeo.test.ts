import { describe, expect, it } from "vitest";
import { buildMerchantReturnPolicy, buildOfferPolicies, buildOfferShippingDetails } from "./merchantSeo";

describe("buildOfferShippingDetails", () => {
  it("charges the flat Rs 250 below the nationwide free threshold", () => {
    expect(buildOfferShippingDetails(1990).shippingRate.value).toBe(250);
    expect(buildOfferShippingDetails(4999).shippingRate.value).toBe(250);
  });

  it("is free from Rs 5,000 (the nationwide rule, not Karachi's lower one)", () => {
    expect(buildOfferShippingDetails(5000).shippingRate.value).toBe(0);
    expect(buildOfferShippingDetails(8400).shippingRate.value).toBe(0);
  });

  it("states PKR, Pakistan only, 3 to 5 days", () => {
    const d = buildOfferShippingDetails(3990);
    expect(d.shippingRate.currency).toBe("PKR");
    expect(d.shippingDestination.addressCountry).toBe("PK");
    expect(d.deliveryTime.transitTime.minValue).toBe(3);
    expect(d.deliveryTime.transitTime.maxValue).toBe(5);
  });
});

describe("buildMerchantReturnPolicy", () => {
  it("is a 3-day finite window for Pakistan, linking the policies page", () => {
    const p = buildMerchantReturnPolicy();
    expect(p.merchantReturnDays).toBe(3);
    expect(p.returnPolicyCategory).toBe("https://schema.org/MerchantReturnFiniteReturnWindow");
    expect(p.applicableCountry).toBe("PK");
    expect(p.merchantReturnLink).toBe("https://wellcaremart.pk/policies");
  });

  it("does not invent who pays return shipping", () => {
    expect("returnFees" in buildMerchantReturnPolicy()).toBe(false);
  });
});

describe("buildOfferPolicies", () => {
  it("returns exactly the two fields Google flagged as missing", () => {
    expect(Object.keys(buildOfferPolicies(3990)).sort()).toEqual(["hasMerchantReturnPolicy", "shippingDetails"]);
  });
});
