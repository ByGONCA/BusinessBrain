import { MetadataRoute } from "next";
import { getTrustedAppUrl } from "@/lib/security/redirects";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getTrustedAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/settings/", "/auth/", "/invite/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
