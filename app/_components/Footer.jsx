// src/components/Footer.jsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-white shadow-[0_-1px_2px_0_rgba(0,0,0,0.1)]">
      <div className="mx-auto max-w-screen-xl max-w-6xl px-[200px] pt-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Company info */}
          <div className="justify-self-center">
            <h3 className="text-md font-bold text-logoblue">
              Company information
            </h3>
            <ul className="mt-4 space-y-1 text-sm text-textcolor">
              <li>Otman Transport AS</li>
              <li>Org.nr. 926425293</li>
              <li>Kjeller, Nittebergsvingen 8, 2007</li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="justify-self-center">
            <h3 className="text-md font-bold text-logoblue">Navigation</h3>
            <ul className="mt-4 space-y-1 text-sm text-textcolor">
              <li>
                <Link href="/services" className="hover:underline">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:underline">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:underline">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="justify-self-center">
            <h3 className="text-md font-bold text-logoblue">Legal</h3>
            <ul className="mt-4 space-y-1 text-sm text-textcolor">
              <li>
                <Link href="/privacy-policy" className="hover:underline">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:underline">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/cookie-policy" className="hover:underline">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pb-6 text-center text-xs text-neutral-600">
        <p>© 2023 - 2026 Otman Transport AS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
