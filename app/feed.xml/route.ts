import { getPublishedBlogPosts } from "@/lib/blog/publicBlogQueries";
import { getLocalizedText } from "@/lib/blog/localizedText";

const SITE_BASE_URL = "https://otman.no";
const FEED_LOCALE = "no" as const;
const FEED_ITEM_COUNT = 30;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const { posts } = await getPublishedBlogPosts({
    locale: FEED_LOCALE,
    page: 1,
    pageSize: FEED_ITEM_COUNT,
    sort: "desc",
  });

  const items = posts
    .map((post) => {
      const url = `${SITE_BASE_URL}/${FEED_LOCALE}/blogg/${post.slug}`;
      const title = getLocalizedText(post.title, FEED_LOCALE);
      const description = getLocalizedText(post.excerpt, FEED_LOCALE);
      const pubDate = (post.publishedAt ?? post.createdAt).toUTCString();

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Otman AS Blog</title>
    <link>${SITE_BASE_URL}/${FEED_LOCALE}/blogg</link>
    <description>Latest posts from Otman AS</description>
    <language>nb-no</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
