"use client";

import { useEffect, useRef } from "react";

type ServiceModalProps = {
  service: string;
  onClose: () => void;
};

export function ServiceModal({ service, onClose }: ServiceModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on backdrop click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div className="customContainer bg-white w-full max-w-md relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <h2 className="text-logoblue text-2xl font-bold mb-1">Book a Service</h2>
        <p className="text-gray-500 text-sm mb-6">Fill in your details and we&apos;ll get back to you shortly.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Handle submission here
            onClose();
          }}
          className="flex flex-col gap-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-semibold text-textColor">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="Jane Doe"
              className="customInput focus:outline-none focus:ring-2 focus:ring-logoblue/40 focus:border-logoblue transition"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-semibold text-textColor">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="jane@example.com"
              className="customInput focus:outline-none focus:ring-2 focus:ring-logoblue/40 focus:border-logoblue transition"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-semibold text-textColor">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+1 234 567 8900"
              className="customInput focus:outline-none focus:ring-2 focus:ring-logoblue/40 focus:border-logoblue transition"
            />
          </div>

          {/* Service (pre-filled, read-only) */}
          <div className="flex flex-col gap-1">
            <label htmlFor="service" className="text-sm font-semibold text-textColor">
              Service
            </label>
            <input
              id="service"
              type="text"
              value={service}
              readOnly
              className="customInput bg-gray-50 text-gray-500 cursor-default focus:outline-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="mt-2 customButtonEnabled h-10 active:scale-[0.98] transition-all duration-150"
          >
            Submit Request
          </button>
        </form>
      </div>
    </div>
  );
}