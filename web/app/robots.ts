import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saverounds.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/embed/"] }, // embed cards live inside other apps
    sitemap: `${SITE}/sitemap.xml`,
  };
}
