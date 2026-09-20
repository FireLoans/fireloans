import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fire Loans",
    short_name: "Fire Loans",
    description:
      "Australian mortgage broker helping first home buyers, refinancers, investors and business owners find the right loan structure.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#051710",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
