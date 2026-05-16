import { createFileRoute } from "@tanstack/react-router";
import heroImage from "@/assets/whatsapp-hero.jpeg";

export const Route = createFileRoute("/")({
  component: IndexPage,
  head: () => ({
    meta: [
      { title: "Wellcare Mart" },
      {
        name: "description",
        content: "A simple landing page showing the selected WhatsApp image.",
      },
      { property: "og:title", content: "Wellcare Mart" },
      {
        property: "og:description",
        content: "A simple landing page showing the selected WhatsApp image.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function IndexPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "0",
        margin: "0",
        backgroundColor: "#000",
      }}
    >
      <img
        src={heroImage}
        alt="WhatsApp image"
        style={{
          maxWidth: "100%",
          maxHeight: "100vh",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
