# Reviews Section

## Source

- `app/_components/Dahsboard/home/ReviewsSection.tsx`

## Responsibility

Displays recent customer reviews on the dashboard. It initially shows six reviews, expands into a scrollable list backed by a 30-review batch, and lets the user fetch additional 30-review batches from the bottom of the list.

## Functions

| Function | Description |
| --- | --- |
| `StarDisplay` | Renders a five-star rating display for one review. |
| `loadReviews` | Fetches the first or next cursor-based batch from the dashboard reviews API. |
| `ReviewsSection` | Loads reviews, manages the compact and expanded states, appends additional batches, and renders loading and error feedback. |
| `handleLoadMore` | Requests the next 30-review batch and appends it to the current list. |
