# Blog Page

## Source

- `app/_components/site/pageComponents/BlogPage.tsx`
- `app/(site)/[locale]/blogg/page.tsx`

## Responsibility

Renders the localized public blog landing page with intro text, static blog cards, query-based search, and date sorting.

## Functions

| Function | Description |
| --- | --- |
| `buildBlogSearchText` | Builds the localized searchable text for a blog post. |
| `getVisiblePosts` | Filters posts by the search query and sorts them by date. |
| `BlogPage` | Renders the blog hero text, search and sort form, and blog gallery. |
| `getSingleParam` | Normalizes a route query value to a single string. |
| `getSortDirection` | Converts the route query sort value to `asc` or `desc`. |
| `Page` | Resolves route params and renders `BlogPage` for the current locale. |
