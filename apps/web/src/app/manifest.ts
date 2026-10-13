import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UniPOS",
    short_name: "UniPOS",
    description: "Modular, offline-first point of sale",
    start_url: "/register",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F0F2F5",
    theme_color: "#1464D2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
