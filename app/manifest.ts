import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scope Project Planner",
    short_name: "Scope",
    description: "A focused, self-hosted planner for projects and teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0D10",
    theme_color: "#0B0D10",
    icons: [
      { src: "/brand/scope-logo-on-dark.png", sizes: "1230x1278", type: "image/png", purpose: "any" },
      { src: "/brand/scope-logo-on-light.png", sizes: "1230x1278", type: "image/png", purpose: "monochrome" },
    ],
  };
}
