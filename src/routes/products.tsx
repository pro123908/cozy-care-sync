import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/products")({
  beforeLoad: ({ location }) => {
    if (location.pathname !== "/products") return;

    throw redirect({
      to: "/",
      search: { category: "all" },
    });
  },
});
