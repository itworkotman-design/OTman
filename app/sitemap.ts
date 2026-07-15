import type { MetadataRoute } from "next";
import { getPublishedBlogSlugsForSitemap } from "@/lib/blog/publicBlogQueries";
import { vehicles } from "@/lib/vehicles";

const baseUrl = "https://otman.no";
const locales = ["no", "en"] as const;

const publicRoutes = [
  { path: "", priority: 1 },
  { path: "/om-oss", priority: 0.8 },
  { path: "/kontakt", priority: 0.8 },
  { path: "/tjenester", priority: 0.8 },
  { path: "/bil-utleie", priority: 0.8 },
  { path: "/blogg", priority: 0.7 },
  { path: "/privacy-policy", priority: 0.4 },
  { path: "/terms", priority: 0.4 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    publicRoutes.map((route) => ({
      url: `${baseUrl}/${locale}${route.path}`,
      lastModified,
      changeFrequency: "monthly",
      priority: route.priority,
    }))
  );

  const posts = await getPublishedBlogSlugsForSitemap();
  const blogPostEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    posts.map((post) => ({
      url: `${baseUrl}/${locale}/blogg/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }))
  );

  const vehicleEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    vehicles.map((vehicle) => ({
      url: `${baseUrl}/${locale}/bil-utleie/${vehicle.id}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    }))
  );

  return [...staticEntries, ...blogPostEntries, ...vehicleEntries];
}
