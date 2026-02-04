import { Suspense } from "react";
import { CatalogSection, CatalogSectionSkeleton } from "../_components/CatalogSection";
import { ServiceWindow } from "../_components/(TransportService)/ServiceWindow";
import { StatsDisplay } from "../_components/(TransportService)/StatsDisplay"
import { PartnersDisplay } from "../_components/(TransportService)/PartnersDisplay"

const items = [
  { title: "Collection & Pickup", href: "/services/collection-pickup" },
  { title: "Package Delivery", href: "/services/package-delivery" },
  { title: "Moving & Relocation", href: "/services/moving-relocation" },
  { title: "Custom Transport", href: "/services/custom-transport" },
  // add more → it will scroll horizontally
];

export default function Home() {
  return (
    <>
      <header className="py-16">
        <h1 className="text-logoblue text-[40px] md:text-[48px] font-bold justify-self-center">Otman Transport</h1>
        <h3 className="text-logoblue text-[18px] md:text-[20px] font-bold justify-self-center">
          Smart Transport. Simple Ordering.
        </h3>
      </header>
      <ServiceWindow items={items} />
      <section className="py-10">
        <h3 className="text-center text-[20px] font-bold pb-2">Are you looking for a reliable transport partner?</h3>
        <p className="text-center mx-auto w-full  max-w-200">From small packages to large projects – we take on everything.  Need help with moving? Need your car transported? Or do you have a package that needs to go out faster than lightning? We can handle it.</p>
      </section>
      <StatsDisplay/>
       <PartnersDisplay/>
      
      
      

      {/*Hid it for now */}
      <div className="hidden pt-2">
          <a
            href="#request"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Request a service
          </a>
        </div>

        {/*Hid it for now */}
      <section id="request" className=" hidden mt-12 rounded-2xl border p-6 text-sm">
        <h2 className="text-base font-semibold">Request a service</h2>
        <p className="mt-2 text-muted-foreground">
          Tell us what you need and weâ€™ll confirm availability and pricing.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="mailto:hello@example.com?subject=Service%20request"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 font-medium hover:bg-accent"
          >
            Email us
          </a>
          <a
            href="tel:+4700000000"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 font-medium hover:bg-accent"
          >
            Call
          </a>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Replace the email/phone with real contact details later.
        </p>
      </section>
    </>
  );
}
