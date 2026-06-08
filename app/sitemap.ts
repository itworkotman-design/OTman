import type { MetadataRoute } from "next";

const baseUrl = "https://otman.no";
const locales = ["no", "en"] as const;

const publicRoutes = [
  { path: "", priority: 1 },
  { path: "/om-oss", priority: 0.8 },
  { path: "/kontakt", priority: 0.8 },
  { path: "/manpower", priority: 0.8 },
  { path: "/privacy-policy", priority: 0.4 },
  { path: "/terms", priority: 0.4 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    publicRoutes.map((route) => ({
      url: `${baseUrl}/${locale}${route.path}`,
      lastModified,
      changeFrequency: "monthly",
      priority: route.priority,
    }))
  );
}
