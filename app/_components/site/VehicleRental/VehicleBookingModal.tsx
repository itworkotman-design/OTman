"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CarRentalContent } from "@/lib/content/CarRentalContent";

type Locale = "en" | "no";
type BookingType = "rent" | "buy";

type Props = {
  vehicleName: string;
  vehicleImage: string;
  locale: Locale;
  listingType: "rental" | "sale";
  buttonLabel: string;
  pricePerDay?: number;
};

type FormData = {
  bookingType: BookingType;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  description: string;
};

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

function toMs(date: string, time: string): number | null {
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}:00`);
  return isNaN(dt.getTime()) ? null : dt.getTime();
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

const EMPTY_FORM = (defaultType: BookingType): FormData => ({
  bookingType: defaultType,
  fromDate: "",
  fromTime: "",
  toDate: "",
  toTime: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  description: "",
});

export default function VehicleBookingModal({ vehicleName, vehicleImage, locale, listingType, buttonLabel, pricePerDay }: Props) {
  const c = CarRentalContent;
  const defaultType: BookingType = listingType === "sale" ? "buy" : "rent";

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM(defaultType));
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const overlayRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => todayISO(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const openModal = () => {
    setFormData(EMPTY_FORM(defaultType));
    setSubmitStatus("idle");
    setOpen(true);
  };

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleFromDateChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      fromDate: val,
      toDate: prev.toDate && prev.toDate < val ? "" : prev.toDate,
      toTime: prev.toDate && prev.toDate < val ? "" : prev.toTime,
    }));
  };

  const priceEstimate = useMemo(() => {
    if (!pricePerDay || !formData.fromDate || !formData.fromTime || !formData.toDate || !formData.toTime) return null;
    const from = toMs(formData.fromDate, formData.fromTime);
    const to = toMs(formData.toDate, formData.toTime);
    if (from === null || to === null || to <= from) return null;
    const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    return { days, total: days * pricePerDay };
  }, [formData.fromDate, formData.fromTime, formData.toDate, formData.toTime, pricePerDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitStatus === "submitting") return;
    setSubmitStatus("submitting");

    try {
      const res = await fetch("/api/public/vehicle-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleName,
          bookingType: formData.bookingType,
          fromDate: formData.bookingType === "rent" ? formData.fromDate : undefined,
          fromTime: formData.bookingType === "rent" ? formData.fromTime : undefined,
          toDate: formData.bookingType === "rent" ? formData.toDate : undefined,
          toTime: formData.bookingType === "rent" ? formData.toTime : undefined,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          description: formData.description.trim() || undefined,
          _hp: honeypotRef.current?.value ?? "",
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitStatus("success");
    } catch {
      setSubmitStatus("error");
    }
  };

  const isRent = formData.bookingType === "rent";

  return (
    <>
      <button onClick={openModal} className="customButtonEnabled lg:w-full h-10">
        {buttonLabel}
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
        >
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            {/* Header: thumbnail + name + close */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
              <div className="relative w-16 h-11 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                <Image src={vehicleImage} alt={vehicleName} fill className="object-cover" sizes="64px" />
              </div>
              <h2 className="text-logoblue font-semibold text-base flex-1 leading-tight">{vehicleName}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {submitStatus === "success" ? (
              <div className="p-10 text-center flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-logoblue font-semibold text-lg">{c.modalSuccess[locale]}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4" noValidate>
                <input
                  type="text"
                  name="_hp"
                  aria-hidden="true"
                  tabIndex={-1}
                  autoComplete="off"
                  ref={honeypotRef}
                  defaultValue=""
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0 }}
                />

                {/* Rent / Buy toggle */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  {(["rent", "buy"] as BookingType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => set("bookingType", type)}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
                        formData.bookingType === type
                          ? "bg-white text-logoblue shadow-sm"
                          : "text-textcolor hover:text-logoblue"
                      }`}
                    >
                      {type === "rent" ? c.modalRent[locale] : c.modalBuy[locale]}
                    </button>
                  ))}
                </div>

                {/* Date + time — rent only */}
                {isRent && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-textcolor/70">{c.modalFromDate[locale]}</label>
                      <input
                        type="date"
                        required
                        min={today}
                        value={formData.fromDate}
                        onChange={(e) => handleFromDateChange(e.target.value)}
                        className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70 w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-textcolor/70">{c.modalFromTime[locale]}</label>
                      <select
                        required
                        value={formData.fromTime}
                        onChange={(e) => set("fromTime", e.target.value)}
                        className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70 w-full"
                      >
                        <option value="" disabled>--:--</option>
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-textcolor/70">{c.modalToDate[locale]}</label>
                      <input
                        type="date"
                        required
                        min={formData.fromDate || today}
                        value={formData.toDate}
                        onChange={(e) => set("toDate", e.target.value)}
                        className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70 w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-textcolor/70">{c.modalToTime[locale]}</label>
                      <select
                        required
                        value={formData.toTime}
                        onChange={(e) => set("toTime", e.target.value)}
                        className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70 w-full"
                      >
                        <option value="" disabled>--:--</option>
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Name + Surname */}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder={c.modalFirstName[locale]}
                    value={formData.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70"
                  />
                  <input
                    type="text"
                    required
                    placeholder={c.modalLastName[locale]}
                    value={formData.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70"
                  />
                </div>

                {/* Email */}
                <input
                  type="email"
                  required
                  placeholder={c.modalEmail[locale]}
                  value={formData.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70 w-full"
                />

                {/* Phone */}
                <input
                  type="tel"
                  required
                  placeholder={c.modalPhone[locale]}
                  value={formData.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70 w-full"
                />

                {/* Description */}
                <textarea
                  placeholder={c.modalDescriptionPlaceholder[locale]}
                  value={formData.description}
                  onChange={(e) => set("description", e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 text-sm text-black/70 w-full resize-none"
                />

                {/* Price estimate */}
                {isRent && priceEstimate && (
                  <div className="rounded-xl bg-logoblue/5 border border-logoblue/10 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-textcolor">
                      {priceEstimate.days} {priceEstimate.days === 1 ? c.modalDay[locale] : c.modalDays[locale]}
                      {" × "}{pricePerDay!.toLocaleString("nb-NO")} NOK
                    </span>
                    <span className="text-logoblue font-semibold">
                      {priceEstimate.total.toLocaleString("nb-NO")} NOK
                    </span>
                  </div>
                )}

                {submitStatus === "error" && (
                  <p className="text-sm text-red-600 text-center">{c.modalError[locale]}</p>
                )}

                <p className="text-xs text-textcolor/60 text-center">{c.modalResponseNote[locale]}</p>

                <button
                  type="submit"
                  disabled={submitStatus === "submitting"}
                  className="customButtonEnabled w-full h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitStatus === "submitting" ? c.modalSending[locale] : c.modalSend[locale]}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
