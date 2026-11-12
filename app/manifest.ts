import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KogSync — The Memory & Intelligence Platform",
    short_name: "KogSync",
    description:
      "The memory and intelligence layer for modern companies. Unified knowledge, institutional decisions, automated workflows, and context in one executive platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090B",
    theme_color: "#09090B",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/KogSyncLogo/KogSync_png.png",
        sizes: "1254x1254",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
