// src/components/Footer.jsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-logoblue md:bg-white shadow-[0_-1px_2px_0_rgba(0,0,0,0.1)]">
      <div className="mx-auto w-full max-w-[800px] px-[20] pt-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {/* Company info */}
          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white md:text-logoblue">
              Company information
            </h3>
            <ul className="mt-4 space-y-1 text-sm">
              <li className="text-white! md:text-textcolor!">Otman Transport AS</li>
              <li className="text-white! md:text-textcolor!">Org.nr. 926425293</li>
              <li className="text-white! md:text-textcolor!">Kjeller, Nittebergsvingen 8, 2007</li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white md:text-logoblue">Navigation</h3>
            <ul className="mt-4 space-y-1 text-sm md:text-textcolor">
              <li>
                <Link href="/services" className="hover:underline text-white! md:text-textcolor!">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:underline text-white! md:text-textcolor!">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:underline text-white! md:text-textcolor!">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="md:justify-self-center">
            <h3 className="text-md font-bold text-white md:text-logoblue">Legal</h3>
            <ul className="mt-4 space-y-1 text-sm">
              <li>
                <Link href="/privacy-policy" className="hover:underline text-white! md:text-textcolor!">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:underline text-white! md:text-textcolor!">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/cookie-policy" className="hover:underline text-white! md:text-textcolor!">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pb-6 text-center text-xs">
        <p className="text-white! md:text-neutral-600!">© 2023 - 2026 Otman Transport AS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
