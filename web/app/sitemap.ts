import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saverounds.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/season`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE}/embed`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];
}
