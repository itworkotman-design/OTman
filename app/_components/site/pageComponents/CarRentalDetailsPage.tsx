import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { vehicles } from "@/lib/vehicles";
import VehicleGallery from "@/app/_components/site/VehicleRental/VehicleGallery";
import VehicleBookingModal from "@/app/_components/site/VehicleRental/VehicleBookingModal";
import { CarRentalContent } from "@/lib/content/CarRentalContent";

type Locale = "en" | "no";

type Props = {
  params: { id: string; locale: Locale };
};

export default function CarRentalDetailsPage({ params }: Props) {
  const { id, locale } = params;
  const vehicle = vehicles.find((v) => v.id === Number(id));

  if (!vehicle) {
    notFound();
  }

  const c = CarRentalContent;

  const fuelMap: Record<string, string> = {
    Electric: c.electric[locale],
    Diesel: c.diesel[locale],
    Petrol: c.petrol[locale],
    Hybrid: c.hybrid[locale],
    Gas: c.gas[locale],
  };

  const typeMap: Record<string, string> = {
    "Small car": c.smallCar[locale],
    "Family car": c.familyCar[locale],
    SUV: c.suv[locale],
    Van: c.van[locale],
  };

  const gearMap: Record<string, string> = {
    Automatic: c.automatic[locale],
    Manual: c.manual[locale],
  };

  const {
    name,
    imageUrl,
    images,
    description,
    features,
    year,
    mileage,
    fuelType,
    vehicleType,
    gearbox,
    location,
    listingType,
    extraKmPrice,
    pricePerDay,
    price,
    finnLink,
    vegvesenLink,
    extraImages,
  } = vehicle;

  const fmt = (n: number) => n.toLocaleString("nb-NO");

  const isVan = vehicleType.toLowerCase().includes("van");
  const vehicleTypeIcon = isVan ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-4 shrink-0">
      <path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3" />
      <path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2" />
      <path d="M9 18h5" />
      <circle cx="16" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-4 shrink-0">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );

  return (
    <section>
      <div className="py-16">
        <h1 className="text-logoblue text-5xl font-bold justify-self-center text-center">{name}</h1>
      </div>

      <div className="lg:customContainer flex flex-col gap-10 mb-16">
        <div>
          <div className="mb-2">
            <Link href={`/${locale}/bil-utleie`} className="text-center text-sm text-textcolor hover:text-logoblue transition">
              {c.backToVehicles[locale]}
            </Link>
          </div>
          <VehicleGallery images={images} name={name} extraImages={extraImages} extraImagesLabel={c.extraImages[locale]} />
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1">
            <h2 className="text-logoblue text-2xl font-semibold mb-4">{c.aboutVehicle[locale]}</h2>
            <p className="text-textcolor leading-relaxed">{description[locale]}</p>

            {features && features.length > 0 && (
              <div className="mt-6">
                <h3 className="text-logoblue text-lg font-semibold mb-3">{c.features[locale]}</h3>
                <ul className="flex flex-col gap-2">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-textcolor text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-logoblue shrink-0" />
                      {f[locale]}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(finnLink || vegvesenLink) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {finnLink && (
                  <a href={finnLink} target="_blank" rel="noopener noreferrer" className="customButtonDefault px-4 h-9 flex items-center text-sm">
                    {c.viewOnFinn[locale]}
                  </a>
                )}
                {vegvesenLink && (
                  <a href={vegvesenLink} target="_blank" rel="noopener noreferrer" className="customButtonDefault px-4 h-9 flex items-center text-sm">
                    {c.viewOnVegvesen[locale]}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="lg:w-72 flex flex-col gap-6">
            <div className="customContainer rounded-2xl p-6 flex flex-col gap-3 border border-lineSecondary">
              <h2 className="text-logoblue text-xl font-semibold mb-2">{c.specifications[locale]}</h2>
              {location && (
                <SpecRow
                  label={c.specLocation[locale]}
                  value={location}
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                  }
                />
              )}
              {year != null && (
                <SpecRow
                  label={c.specYear[locale]}
                  value={String(year)}
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-4 shrink-0">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                      />
                    </svg>
                  }
                />
              )}
              {mileage != null && (
                <SpecRow
                  label={c.specMileage[locale]}
                  value={`${fmt(mileage)} km`}
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.34 15a9 9 0 1 1 17.32 0" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12 9.5 7.5" />
                      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                    </svg>
                  }
                />
              )}
              <SpecRow
                label={c.specFuelType[locale]}
                value={fuelMap[fuelType] ?? fuelType}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-4 shrink-0">
                    <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" />
                    <path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" />
                    <path d="M2 21h13" />
                    <path d="M3 9h11" />
                  </svg>
                }
              />
              <SpecRow label={c.specVehicleType[locale]} value={typeMap[vehicleType] ?? vehicleType} icon={vehicleTypeIcon} />
              <SpecRow
                label={c.specGearbox[locale]}
                value={gearMap[gearbox] ?? gearbox}
                icon={
                  <svg
                    width="16"
                    height="11"
                    viewBox="-2 0 30 19"
                    fill="none"
                    stroke="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-4 shrink-0"
                  >
                    <circle cx="22.2858" cy="1.71429" r="1.71429" />
                    <circle cx="8.57147" cy="1.71429" r="1.71429" />
                    <circle cx="1.71429" cy="1.71429" r="1.71429" />
                    <circle cx="8.57147" cy="16.4575" r="1.71429" />
                    <circle cx="15.4286" cy="16.4575" r="1.71429" />
                    <circle cx="22.2858" cy="16.4575" r="1.71429" />
                    <line x1="8.38574" y1="2.21387" x2="8.38574" y2="16.9853" />
                    <line x1="22.1001" y1="2.21387" x2="22.1001" y2="16.9853" />
                    <path d="M1.71411 1.02832V5.99976C1.71411 8.39976 3.1884 9.59977 4.97126 9.59977C6.75412 9.59977 17.0284 9.59977 22.457 9.59977" />
                    <line x1="15.5" y1="2.21387" x2="15.5" y2="16.9853" />
                    <circle cx="15.7143" cy="1.71429" r="1.71429" />
                  </svg>
                }
              />
            </div>

            <div className="customContainer rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                {pricePerDay != null && (
                  <div className="flex items-baseline gap-2">
                    <div>
                      <span className="text-textcolor text-sm">{c.pricePerDay[locale]}:</span>
                    </div>
                    <div className="grow text-right">
                      <span className="text-logoblue text-3xl font-semibold leading-none">{fmt(pricePerDay)}</span>
                      <span className="text-textcolor text-sm"> NOK</span>
                    </div>
                  </div>
                )}
                {price != null && (
                  <div className="flex items-baseline gap-2 ">
                    <div>
                      <span className="text-textcolor text-sm">{c.price[locale]}:</span>
                    </div>
                    <div className="grow text-right">
                      <span className="text-logoblue text-3xl font-semibold leading-none">{fmt(price)}</span>
                      <span className="text-textcolor text-sm"> NOK</span>
                    </div>
                  </div>
                )}
                {listingType === "rental" && extraKmPrice != null && (
                  <span className="text-textColorThird text-sm mt-1 text-center">
                    {fmt(extraKmPrice)} NOK {c.extraKm[locale]}
                  </span>
                )}
              </div>
              <VehicleBookingModal
                vehicleName={name}
                vehicleImage={imageUrl}
                locale={locale}
                listingType={listingType}
                buttonLabel={c.orderNow[locale]}
                pricePerDay={pricePerDay}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpecRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm items-center">
      <span className="flex items-center gap-1.5 text-textcolor">
        {icon}
        {label}
      </span>
      <span className="text-logoblue font-medium">{value}</span>
    </div>
  );
}
