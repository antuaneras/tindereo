import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const appPath = basePath ? `${basePath}/` : "/";

  return {
    name: "Tindereo",
    short_name: "Tindereo",
    description:
      "Matching para tardeos y eventos con perfiles, chat y panel de organizacion.",
    start_url: appPath,
    scope: appPath,
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#f97316",
    lang: "es-ES",
    icons: [
      {
        src: `${basePath}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: `${basePath}/icon-192-maskable.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: `${basePath}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: `${basePath}/icon-512-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
