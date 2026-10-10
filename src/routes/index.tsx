import { createFileRoute } from "@tanstack/react-router";
import { ImageResizer } from "@/components/image-resizer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image Resizer — Resize & Compress Images Online" },
      {
        name: "description",
        content:
          "Resize images by pixels or target file size, adjust quality, and convert between JPG, PNG, and WebP — free, private, and processed entirely in your browser.",
      },
      { property: "og:title", content: "Image Resizer — Resize & Compress Images Online" },
      {
        property: "og:description",
        content:
          "Resize images by pixels or target file size, adjust quality, and convert between JPG, PNG, and WebP — free and processed entirely in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ImageResizer />;
}
