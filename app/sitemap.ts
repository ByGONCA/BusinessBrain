import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kogsync.com";
  const lastModified = new Date();

  const routes = [
    "",
    "/pricing",
    "/product",
    "/company-graph",
    "/integrations",
    "/faq",
    "/privacy",
    "/terms",
    "/cookies",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : route === "/pricing" ? 0.9 : 0.7,
  }));
}
