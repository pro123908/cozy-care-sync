import { describe, expect, it } from "vitest";
import {
  buildOrganizationJsonLd,
  htmlFragmentToMarkdown,
  isKnownInteractiveOnlyRoute,
  isNonInteractiveFetcher,
  notFoundMarkdownBody,
  prefersMarkdown,
  renderMarkdownDoc,
} from "./agentReadiness";

function headers(entries: Record<string, string>) {
  return {
    get(name: string) {
      return entries[name.toLowerCase()] ?? null;
    },
  };
}

describe("isNonInteractiveFetcher", () => {
  it("treats a plain curl request (no Sec-Fetch-Mode) as non-interactive", () => {
    expect(isNonInteractiveFetcher({ headers: headers({ "user-agent": "curl/8.0" }) })).toBe(true);
  });

  it("treats a real browser navigation (Sec-Fetch-Mode present) as interactive", () => {
    expect(
      isNonInteractiveFetcher({
        headers: headers({ "user-agent": "Mozilla/5.0 Chrome/120", "sec-fetch-mode": "navigate" }),
      }),
    ).toBe(false);
  });

  it("still flags a known bot UA as non-interactive even if it sends Sec-Fetch-Mode", () => {
    expect(
      isNonInteractiveFetcher({
        headers: headers({ "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.0)", "sec-fetch-mode": "navigate" }),
      }),
    ).toBe(true);
  });
});

describe("isKnownInteractiveOnlyRoute", () => {
  it("recognizes exact known routes", () => {
    for (const path of ["/checkout", "/account", "/search", "/track-order", "/wishlist", "/orders"]) {
      expect(isKnownInteractiveOnlyRoute(path)).toBe(true);
    }
  });

  it("recognizes order detail routes by prefix", () => {
    expect(isKnownInteractiveOnlyRoute("/orders/abc123")).toBe(true);
  });

  it("ignores a trailing slash", () => {
    expect(isKnownInteractiveOnlyRoute("/checkout/")).toBe(true);
  });

  it("does not treat content pages as interactive-only", () => {
    expect(isKnownInteractiveOnlyRoute("/about")).toBe(false);
    expect(isKnownInteractiveOnlyRoute("/products/some-id")).toBe(false);
  });

  it("does not treat a genuinely unknown path as known", () => {
    expect(isKnownInteractiveOnlyRoute("/this-path-does-not-exist")).toBe(false);
  });
});

describe("prefersMarkdown", () => {
  it("returns true for a bare 'text/markdown' Accept header", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
  });

  it("returns false for a missing Accept header", () => {
    expect(prefersMarkdown(null)).toBe(false);
  });

  it("returns false for the default curl/browser 'Accept: */*'", () => {
    expect(prefersMarkdown("*/*")).toBe(false);
  });

  it("returns false for a normal browser Accept header", () => {
    expect(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(false);
  });

  it("prefers markdown when it has a higher q-value than html", () => {
    expect(prefersMarkdown("text/markdown, text/html;q=0.5")).toBe(true);
  });

  it("prefers html when it has a higher q-value than markdown", () => {
    expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
  });
});

describe("htmlFragmentToMarkdown", () => {
  it("converts headings, paragraphs, and links", () => {
    const html = `<h2>Section</h2><p>Hello <a href="/there">there</a>.</p>`;
    const md = htmlFragmentToMarkdown(html);
    expect(md).toContain("## Section");
    expect(md).toContain("Hello [there](/there).");
  });

  it("converts a product list item", () => {
    const html = `<ul><li>
  <a href="/products/foo">
    <img src="/img.jpg" alt="Foo Product" width="120" />
    <h3>Foo Product</h3>
    <p>Rs 1,000</p>
  </a>
</li></ul>`;
    const md = htmlFragmentToMarkdown(html);
    expect(md).toContain("- [Foo Product");
    expect(md).toContain("Rs 1,000");
  });

  it("converts strikethrough and strong", () => {
    expect(htmlFragmentToMarkdown("<s>Rs 200</s>")).toBe("~~Rs 200~~");
    expect(htmlFragmentToMarkdown("<strong>Bold</strong>")).toBe("**Bold**");
  });

  it("decodes HTML entities", () => {
    expect(htmlFragmentToMarkdown("<p>Terms &amp; Conditions</p>")).toContain("Terms & Conditions");
  });

  it("strips any tag it doesn't otherwise handle", () => {
    expect(htmlFragmentToMarkdown("<div>plain</div>")).not.toContain("<div>");
  });
});

describe("renderMarkdownDoc", () => {
  it("includes the title, description, canonical source, and body", () => {
    const doc = renderMarkdownDoc({
      title: "About Wellcare Mart",
      description: "Learn about us.",
      canonical: "https://wellcaremart.pk/about",
      bodyHtml: "<p>We sell medical supplies.</p>",
    });
    expect(doc).toContain("# About Wellcare Mart");
    expect(doc).toContain("Learn about us.");
    expect(doc).toContain("Source: https://wellcaremart.pk/about");
    expect(doc).toContain("We sell medical supplies.");
  });
});

describe("notFoundMarkdownBody", () => {
  it("names the requested path and links to the sitemap and llms.txt", () => {
    const body = notFoundMarkdownBody("/no-such-page");
    expect(body).toContain("/no-such-page");
    expect(body).toContain("/sitemap.xml");
    expect(body).toContain("/llms.txt");
  });
});

describe("buildOrganizationJsonLd", () => {
  it("includes a contactPoint with telephone/email and a PostalAddress", () => {
    const jsonLd = buildOrganizationJsonLd() as any;
    expect(jsonLd["@type"]).toBe("Organization");
    expect(jsonLd.contactPoint["@type"]).toBe("ContactPoint");
    expect(jsonLd.contactPoint.telephone).toMatch(/^\+92/);
    expect(jsonLd.contactPoint.email).toContain("@");
    expect(jsonLd.address["@type"]).toBe("PostalAddress");
    expect(jsonLd.address.addressCountry).toBe("PK");
  });
});
