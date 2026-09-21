import { createFileRoute } from "@tanstack/react-router";
import { PRODUCTS, findBundleBySlug } from "@/wcm/data";
import { BundlePage } from "@/wcm/bundle-page";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/bundles/$bundleId")({
  component: BundleRoute,
  head: ({ params }: { params: { bundleId: string } }) => {
    const bundle = findBundleBySlug(params.bundleId);
    const names = bundle
      ? bundle.ids.map((id) => PRODUCTS.find((p) => p.id === id)?.name).filter(Boolean)
      : [];
    const title = names.length === 2 ? `${names[0]} + ${names[1]} Bundle — Wellcare Mart` : "Bundle deal — Wellcare Mart";
    const description =
      names.length === 2
        ? `Buy ${names[0]} and ${names[1]} together and save. Free delivery, discount applied automatically.`
        : "Buy together and save at Wellcare Mart.";
    return {
      links: [{ rel: "canonical", href: canonicalUrl(`/bundles/${params.bundleId}`) }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "robots", content: "index, follow" },
      ],
    };
  },
});

function BundleRoute() {
  const { bundleId } = Route.useParams();
  return <BundlePage slug={bundleId} />;
}
