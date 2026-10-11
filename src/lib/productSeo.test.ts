import { describe, expect, it } from "vitest";
import {
  buildCategoryDescription,
  buildCategorySeoTitle,
  buildMetaDescription,
  buildProductSeoTitle,
  getSeoDescriptor,
} from "./productSeo";

describe("getSeoDescriptor", () => {
  it("never returns the old generic 'Medical Product'", () => {
    expect(getSeoDescriptor("Axon Hearing Aid C-109 (Rechargeable)", "hearing-aids")).toBe("");
    expect(getSeoDescriptor("Master Blood Glucose Strips 50pcs", "sugar-strips")).toBe("");
    expect(getSeoDescriptor("Anything", undefined)).toBe("");
    expect(getSeoDescriptor("Anything", null)).toBe("");
  });

  it("skips the descriptor when the name already says it", () => {
    expect(getSeoDescriptor("Electronic Blood Pressure Monitor", "bp-digital")).toBe("");
    expect(getSeoDescriptor("Medisign 830 Digital Rechargeable Blood Pressure Monitor", "bp-digital")).toBe("");
    expect(getSeoDescriptor("Atom Blood Glucose Meter", "glucometers")).toBe("");
  });

  it("adds the descriptor when the name does not cover it", () => {
    expect(getSeoDescriptor("Certeza BM-405", "bp-digital")).toBe("Digital Blood Pressure Monitor");
    expect(getSeoDescriptor("Accu-Chek Instant S", "glucometers")).toBe("Blood Glucose Meter");
  });
});

describe("buildProductSeoTitle", () => {
  it("is just 'name — Wellcare Mart' for generic categories", () => {
    expect(buildProductSeoTitle("Axon Hearing Aid C-109 (Rechargeable)", "hearing-aids")).toBe(
      "Axon Hearing Aid C-109 (Rechargeable) — Wellcare Mart",
    );
  });

  it("does not repeat words already in the name", () => {
    expect(buildProductSeoTitle("Electronic Blood Pressure Monitor", "bp-digital")).toBe(
      "Electronic Blood Pressure Monitor — Wellcare Mart",
    );
  });

  it("appends a useful descriptor", () => {
    expect(buildProductSeoTitle("Certeza BM-405", "bp-digital")).toBe(
      "Certeza BM-405 Digital Blood Pressure Monitor — Wellcare Mart",
    );
  });

  it("drops the descriptor rather than exceed ~65 characters", () => {
    const longName = "Some Very Long Imported Brand Model XZ-1000 Pro Edition";
    const title = buildProductSeoTitle(longName, "bp-digital");
    expect(title).toBe(`${longName} — Wellcare Mart`);
  });
});

describe("buildMetaDescription", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(buildMetaDescription("  Short   text. ")).toBe("Short text.");
  });

  it("cuts a long blurb at a sentence end within 155 characters", () => {
    const blurb =
      "Axon Hearing Aid C-109 is a rechargeable behind-the-ear hearing aid that amplifies sound for people who are hard of hearing. It runs up to 30 hours after a full charge, so there is no battery to replace.";
    const out = buildMetaDescription(blurb);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("hard of hearing.")).toBe(true);
  });

  it("falls back to a word boundary with an ellipsis when no sentence fits", () => {
    const blurb = "word ".repeat(80).trim();
    const out = buildMetaDescription(blurb);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });

  it("never returns more than the limit", () => {
    for (const n of [150, 155, 156, 200, 400]) {
      expect(buildMetaDescription("a".repeat(n)).length).toBeLessThanOrEqual(155);
    }
  });
});

describe("category SEO text", () => {
  it("builds a title", () => {
    expect(buildCategorySeoTitle("Hearing Aids")).toBe("Hearing Aids Online in Pakistan — Wellcare Mart");
  });

  it("drops 'Online in Pakistan' when the title would be too long", () => {
    const t = buildCategorySeoTitle("Some Fairly Long Category Name For Tests");
    expect(t.length).toBeLessThanOrEqual(65);
    expect(t).not.toContain("Online in Pakistan");
  });

  it("describes a category with count, lowest price and real brands only", () => {
    const d = buildCategoryDescription("Hearing Aids", [
      { price: 1990, brand: "Axon" },
      { price: 3990, brand: "Axon" },
      { price: 3890, brand: "Tulus" },
      { price: 2600, brand: "Imported" },
    ]);
    expect(d).toContain("Shop 4 Hearing Aids products");
    expect(d).toContain("from Rs 1,990");
    expect(d).toContain("Brands: Axon, Tulus.");
    expect(d).not.toContain("Imported");
    expect(d.length).toBeLessThanOrEqual(155);
  });

  it("handles an empty or unpriced category", () => {
    expect(buildCategoryDescription("Mobility", [])).toContain("Shop Mobility at Wellcare Mart");
    expect(buildCategoryDescription("Mobility", [{ price: 0 }])).toContain("Shop Mobility at Wellcare Mart");
  });
});
