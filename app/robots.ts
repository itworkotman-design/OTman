import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/booking/",
        "/dashboard/",
        "/client-login/",
        "/login/",
        "/reset-password/",
        "/accept-invite/",
      ],
    },
    sitemap: "https://otman.no/sitemap.xml",
  };
}
