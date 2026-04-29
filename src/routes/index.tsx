import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/wcm/App";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "Wellcare Mart — Medical Supplies & Equipment" },
      { name: "description", content: "Shop trusted medical supplies, monitoring devices, and wellness essentials. Free same-day delivery in Karachi on orders above Rs 2,000." },
    ],
  }),
});
