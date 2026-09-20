import { useEffect } from "react";
import type { BundleResult } from "./data";
import { trackBundleAppliedOnce, type BundleClickSource } from "@/lib/meta-pixel";

/**
 * Fires a BundleApplied event the first time (per browser session) a given
 * bundle / mix & match pair is actually formed in the cart or checkout — this
 * catches shoppers who added the two products separately, not just via
 * "Add both". Renders nothing.
 */
export function BundleAppliedTracker({
  bundles,
  nameOf,
  source,
}: {
  bundles: BundleResult;
  nameOf: (id: string) => string;
  source: BundleClickSource;
}) {
  const pairs = [
    ...bundles.applied.map((x) => ({ a: x.bundle.ids[0], b: x.bundle.ids[1], discount: x.bundle.discount, kind: "bundle" })),
    ...bundles.mixPairs.map((x) => ({ a: x.a, b: x.b, discount: x.discount, kind: "mix & match" })),
  ];
  const signature = pairs.map((p) => [p.a, p.b].sort().join("+")).join("|");

  useEffect(() => {
    for (const pair of pairs) {
      trackBundleAppliedOnce([pair.a, pair.b].sort().join("+"), {
        productIds: [pair.a, pair.b],
        label: `${nameOf(pair.a)} + ${nameOf(pair.b)}`,
        source,
        extra: { discount: String(pair.discount), kind: pair.kind },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
}
