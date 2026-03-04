import { Suspense } from "react";
import { CatalogSection, CatalogSectionSkeleton } from "../_components/CatalogSection";
import { ServiceWindow } from "../_components/site/TransportService/ServiceWindow";
import { StatsDisplay } from "../_components/site/TransportService/StatsDisplay"
import { PartnersDisplay } from "../_components/site/TransportService/PartnersDisplay"

const items = [
  { title: "Collection & Pickup", href: "/services/collection-pickup", svg: "Service logos-01.svg" },
  { title: "Package Delivery", href: "/services/package-delivery", svg: "Service logos-02.svg" },
  { title: "Moving & Relocation", href: "/services/moving-relocation", svg: "Service logos-03.svg" },
  { title: "Custom Transport", href: "/services/custom-transport", svg: "Service logos-04.svg" },
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

    </>
  );
}
