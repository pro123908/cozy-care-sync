import { useCallback } from "react";
import { useTestimonials } from "./context";

// Review figures for a product, from the published Facebook / Daraz reviews (the same
// product_reviews rows behind the "Satisfied customers" slider). The `rating` and
// `reviews` columns on products are 0 for the whole catalog, so nothing should read them.

export type ReviewStats = {
  count: number;
  /** Reviews that carry a star rating (a Facebook reaction often has none). */
  ratedCount: number;
  /** Mean of the rated reviews, 0 when none are rated. */
  average: number;
  /** Source names, e.g. ["Daraz", "Facebook"]. */
  sources: string[];
};

const SOURCE_LABELS: Record<string, string> = { daraz: "Daraz", facebook: "Facebook" };

export function useReviewStats(): (productId: string) => ReviewStats | null {
  const { testimonials } = useTestimonials();
  return useCallback(
    (productId: string) => {
      const rows = testimonials.filter((t) => t.product_id === productId);
      if (rows.length === 0) return null;
      const ratings = rows
        .map((t) => t.rating)
        .filter((r): r is number => typeof r === "number" && r > 0);
      const sources = Array.from(
        new Set(rows.map((t) => SOURCE_LABELS[t.source] ?? t.source)),
      ).sort();
      return {
        count: rows.length,
        ratedCount: ratings.length,
        average: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        sources,
      };
    },
    [testimonials],
  );
}

/** "1 Daraz review", "3 reviews · Daraz & Facebook". */
export function describeReviews(stats: ReviewStats): string {
  const noun = stats.count === 1 ? "review" : "reviews";
  const from = stats.sources.join(" & ");
  return stats.count === 1 ? `1 ${from} ${noun}` : `${stats.count} ${noun} · ${from}`;
}
