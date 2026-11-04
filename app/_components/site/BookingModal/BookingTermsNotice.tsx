"use client";

import Link from "next/link";
import { WITHDRAWAL_CONSENT_TEXT } from "@/lib/orders/withdrawalConsent";
import { OTMAN_PHONE } from "@/lib/content/companyContact";

type Props = {
  locale: "en" | "no";
  // A quote request ("Send forespørsel") rather than a booking.
  isRequest?: boolean;
  // The cancellation and wasted-trip fees (a booking; a quote request has no price yet).
  showFees?: boolean;
  // A private customer booking a service: the withdrawal-period request
  // (lib/orders/withdrawalConsent.ts). The submit button waits for it.
  consentRequired?: boolean;
  consent?: boolean;
  onConsentChange?: (value: boolean) => void;
};

// Above "Send bestilling": our fees, the terms and privacy links, and — for a
// service — the checkbox asking for it within the withdrawal period. Matches
// the terms page (lib/content/LegalContent.ts: Avbestilling, Angrerett).
export function BookingTermsNotice({ locale, isRequest = false, showFees = true, consentRequired = false, consent = false, onConsentChange }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const linkClass = "font-semibold text-logoblue underline underline-offset-2 hover:opacity-70";
  const termsLink = (
    <Link href={`/${locale}/terms`} target="_blank" className={linkClass}>
      {t("terms", "vilkårene")}
    </Link>
  );

  return (
    <div className="flex flex-col gap-3 text-xs leading-relaxed text-black/60">
      {showFees && (
        <div className="rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/70">
            {t("Cancellation and fees", "Avbestilling og gebyrer")}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>
              {t(
                "Free cancellation up to 48 hours before the job — you get everything back.",
                "Gratis avbestilling frem til 48 timer før oppdraget — du får alt tilbake.",
              )}
            </li>
            <li>
              {t(
                "Cancelling later costs 40 % of the price; the rest is refunded to your card.",
                "Avbestiller du senere, koster det 40 % av prisen. Resten tilbakebetales til kortet ditt.",
              )}
            </li>
            <li>
              {t(
                "If we arrive and can't do the job because no one is home, there's no access, or the information was wrong, we charge a wasted-trip fee.",
                "Kommer vi som avtalt, men kan ikke utføre oppdraget fordi ingen er hjemme, det mangler adkomst eller opplysningene var feil, tar vi et gebyr for bomtur.",
              )}
            </li>
            <li>
              {t(`To cancel, call ${OTMAN_PHONE} or email info@otman.no.`, `Avbestill på telefon ${OTMAN_PHONE} eller e-post info@otman.no.`)}
            </li>
          </ul>
        </div>
      )}

      {consentRequired && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-logoblue/25 bg-logoblue/[0.04] px-4 py-3 text-black/75">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => onConsentChange?.(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-logoblue"
          />
          <span>
            {t(WITHDRAWAL_CONSENT_TEXT.en, WITHDRAWAL_CONSENT_TEXT.no)}{" "}
            <Link href={`/${locale}/terms`} target="_blank" className={linkClass}>
              {t("About the right of withdrawal", "Om angreretten")}
            </Link>
          </span>
        </label>
      )}

      <p>
        {isRequest
          ? t("By sending the request you accept our ", "Ved å sende forespørselen godtar du ")
          : t("By sending the order you accept our ", "Ved å sende bestillingen godtar du ")}
        {termsLink}
        {t(". How we handle your details: ", ". Slik behandler vi opplysningene dine: ")}
        <Link href={`/${locale}/privacy-policy`} target="_blank" className={linkClass}>
          {t("privacy policy", "personvernerklæringen")}
        </Link>
        .
      </p>
    </div>
  );
}
