"use client";

import { useEffect, useRef, useState } from "react";
import { COMMENT_MAX_LENGTH, stripUnsafeChars } from "@/lib/reviews";

// TODO: replace with the real Google review / "write a review" link for Otman AS
const GOOGLE_REVIEW_URL = "https://g.page/r/REPLACE_ME/review";

const REDIRECT_DELAY_MS = 3000;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

function GoogleReviewButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={GOOGLE_REVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2.5 rounded-full bg-white border border-lineSecondary pl-4 pr-5 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-all duration-200 hover:shadow-[0_6px_18px_rgba(0,0,0,0.14)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_8px_rgba(0,0,0,0.1)] ${className}`}
    >
      <GoogleIcon />
      <span className="font-semibold text-sm text-textcolor group-hover:text-logoblue transition-colors">
        Legg igjen en Google-anmeldelse
      </span>
    </a>
  );
}

function CarIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="35"
      height="19"
      viewBox="0 0 35 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g clipPath="url(#clip0_151_7)">
        <path
          d="M26.4379 0.585789C26.813 0.960862 27.0237 1.46956 27.0237 1.99999V6.00041H29.5746C30.4901 6.00041 31.3555 6.41846 31.9246 7.13561L34.35 10.1921C34.7709 10.7226 35 11.3798 35 12.0569V15.0112C35 15.5635 34.5523 16.0112 34 16.0112H2.5L0.999909 16.0562C0.734676 16.0562 0.480306 15.9508 0.292758 15.7633C0.10521 15.5757 -0.000152588 15.3214 -0.000152588 15.0562L0.0235993 1.99999C0.0235993 1.46956 0.234326 0.960852 0.609421 0.585779C0.984517 0.210706 1.49326 -7.15256e-06 2.02372 -7.15256e-06L25.0237 0C25.5541 0 26.0628 0.210716 26.4379 0.585789Z"
          fill="white"
        />
        <path
          d="M6 19C7.65685 19 9 17.6569 9 16C9 14.3431 7.65685 13 6 13C4.34315 13 3 14.3431 3 16C3 17.6569 4.34315 19 6 19Z"
          fill="white"
        />
        <path
          d="M29 19C30.6569 19 32 17.6569 32 16C32 14.3431 30.6569 13 29 13C27.3431 13 26 14.3431 26 16C26 17.6569 27.3431 19 29 19Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id="clip0_151_7">
          <rect width="35" height="19" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function roundedRectPath(width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} V ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 0 ${height - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

function BorderCar({ radius = 20 }: { radius?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const container = hostRef.current?.parentElement;
    if (!container) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {size && size.width > 0 && size.height > 0 && (
        <div
          className="border-car absolute left-0 top-0 h-30 w-30"
          style={{ offsetPath: `path("${roundedRectPath(size.width, size.height, radius)}")` }}
        >
          <CarIcon className="h-full w-full" />
        </div>
      )}
    </div>
  );
}

function Star({ filled, locked, onClick }: { filled: boolean; locked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-label="Vurder"
      className={`p-1 ${locked ? "cursor-default" : "cursor-pointer"}`}
    >
      <svg
        className={`w-10 h-10 ${filled ? "text-logoblue" : "text-lineSecondary"}`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345l2.125-5.111Z" />
      </svg>
    </button>
  );
}

export default function ReviewsForm({ alreadySubmitted }: { alreadySubmitted: boolean }) {
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const honeypotRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!rating) return;

    setStatus("submitting");

    try {
      const res = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: rating <= 3 ? comment.trim() : "",
          _hp: honeypotRef.current?.value ?? "",
        }),
      });

      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      setSubmitted(true);
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (status !== "success") return;

    const timeout = setTimeout(() => {
      window.location.href = "/";
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [status]);

  if (submitted) {
    const justSubmitted = status === "success";

    return (
      <div className="customContainer bg-white max-w-[440] w-full text-center">
        <p className="text-lg text-textcolor font-semibold">Takk for tilbakemeldingen din!</p>
        {justSubmitted && rating !== null && rating > 3 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-textColorSecond mb-3">Har du lyst til å dele det offentlig også?</p>
            <GoogleReviewButton />
          </div>
        )}
        {justSubmitted && (
          <p className="mt-4 text-xs text-textColorThird">Du blir sendt til forsiden om noen sekunder...</p>
        )}
        {!justSubmitted && (
          <p className="mt-2 text-sm text-textColorSecond">
            Du har allerede sendt oss en tilbakemelding
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="customContainer relative bg-white max-w-[520] w-full">
      <BorderCar />
      <input
        type="text"
        name="_hp"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0 }}
        defaultValue=""
        ref={honeypotRef}
      />

      <h1 className="text-center text-xl font-semibold text-textcolor mb-1">Hvordan var opplevelsen din?</h1>
      <p className="text-center text-sm text-textColorSecond mb-4">Trykk på en stjerne for å gi din vurdering.</p>

      <div className="flex justify-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((value) => (
          <Star key={value} filled={rating !== null && value <= rating} locked={rating !== null} onClick={() => setRating(value)} />
        ))}
      </div>

      {rating !== null && rating > 3 && (
        <div className="text-center mb-4">
          <p className="text-sm text-textcolor mb-3">Så bra å høre! Har du lyst til å legge igjen en anmeldelse på Google?</p>
          <GoogleReviewButton />
        </div>
      )}

      {rating !== null && rating <= 3 && (
        <div className="mb-4">
          <label className="block pb-1 text-sm text-textcolor font-semibold" htmlFor="review-comment">
            Leit å høre. Hva gikk galt?
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(stripUnsafeChars(e.target.value))}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Fortell oss hva som skjedde..."
            className="customInput w-full h-28"
          />
        </div>
      )}

      {status === "error" && <p className="mb-4 text-sm text-red-600 text-center">Noe gikk galt. Vennligst prøv igjen.</p>}

      {rating !== null && (
        <div className="w-full flex justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === "submitting"}
            className="customButtonEnabled  w-[200] min-w-[60] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? "Sender..." : "Send inn"}
          </button>
        </div>
      )}
    </div>
  );
}
