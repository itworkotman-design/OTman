import type { ArchiveConditionFlags } from "./types";

// Priority order when more than one flag is true: overdue/expired outrank
// the "soon" variants since they're the more urgent state to surface.
export function ConditionBadge({ flags, locale }: { flags: ArchiveConditionFlags; locale: string }) {
  if (flags.isOverdue) {
    return (
      <span className="shrink-0 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
        {locale === "nb" ? "Forfalt" : "Overdue"}
      </span>
    );
  }

  if (flags.isExpired) {
    return (
      <span className="shrink-0 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
        {locale === "nb" ? "Utløpt" : "Expired"}
      </span>
    );
  }

  if (flags.isDueSoon) {
    return (
      <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
        {locale === "nb" ? "Forfaller snart" : "Due soon"}
      </span>
    );
  }

  if (flags.isExpiringSoon) {
    return (
      <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
        {locale === "nb" ? "Utløper snart" : "Expiring soon"}
      </span>
    );
  }

  return null;
}
