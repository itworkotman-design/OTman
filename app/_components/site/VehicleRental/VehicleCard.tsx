"use client";
import Image from "next/image";
import React from "react";
import Link from "next/link";
import { CarRentalContent } from "@/lib/content/CarRentalContent";

export interface VehicleProps {
  id: number;
  name: string;
  imageUrl: string;
  images: string[];
  description: { en: string; no: string };
  features: { en: string; no: string }[];
  mileage?: number;
  fuelType: string;
  vehicleType: string;
  gearbox: string;
  year?: number;
  location?: string;
  listingType: "rental" | "sale";
  extraKmPrice?: number;
  pricePerDay?: number;
  price?: number;
  finnLink?: string;
  vegvesenLink?: string;
  extraImages?: string[];
}

type Locale = "en" | "no";

type VehicleCardProps = VehicleProps & {
  locale: Locale;
  content: typeof CarRentalContent;
};

const VehicleCard: React.FC<VehicleCardProps> = ({
  id,
  name,
  imageUrl,
  features,
  mileage,
  year,
  location,
  fuelType,
  vehicleType,
  gearbox,
  listingType,
  extraKmPrice,
  pricePerDay,
  price,
  locale,
  content,
}) => {
  const fuelMap: Record<string, string> = {
    Electric: content.electric[locale],
    Diesel: content.diesel[locale],
    Petrol: content.petrol[locale],
    Hybrid: content.hybrid[locale],
    Gas: content.gas[locale],
  };

  const typeMap: Record<string, string> = {
    "Small car": content.smallCar[locale],
    "Family car": content.familyCar[locale],
    SUV: content.suv[locale],
    Van: content.van[locale],
  };

  const gearMap: Record<string, string> = {
    Automatic: content.automatic[locale],
    Manual: content.manual[locale],
  };

  const carTypeIcons = {
    Car: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
    Van: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5">
        <path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3" />
        <path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2" />
        <path d="M9 18h5" />
        <circle cx="16" cy="18" r="2" />
        <circle cx="7" cy="18" r="2" />
      </svg>
    ),
  };

  const normalizedVehicleType = vehicleType.toLowerCase();
  const selectedCarType = normalizedVehicleType.includes("van") ? "Van" : "Car";

  const fmt = (n: number) => n.toLocaleString("nb-NO");

  return (
    <div className="relative left-0 w-full flex flex-col lg:flex-row customContainer gap-4 lg:gap-10">
      <div className="relative w-full min-h-[250] lg:min-h-[400] lg:flex-1  rounded-2xl overflow-hidden">
        <Link href={`/bil-utleie/${id}`} className="absolute inset-0 block">
          <Image
            src={imageUrl}
            fill
            alt="Vehicle img"
            className="object-contain scale-100"
            sizes="(min-width: 1024px) 600px, 100vw"
          />
        </Link>
      </div>

      <div className="flex flex-1 flex-col ">
        <h2 className="text-logoblue text-center text-3xl font-semibold mb-10">{name}</h2>

        {/* Two columns: specs | features */}
        <div className="flex flex-1 gap-8 pb-6">
          <ul className="flex flex-col gap-2">
            {location && (
              <li className="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <FeatureItem label={location} />
              </li>
            )}
            <li className="flex gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5 shrink-0">
                <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" />
                <path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" />
                <path d="M2 21h13" />
                <path d="M3 9h11" />
              </svg>
              <FeatureItem label={fuelMap[fuelType] ?? fuelType} />
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">{carTypeIcons[selectedCarType]}</span>
              <FeatureItem label={typeMap[vehicleType] ?? vehicleType} />
            </li>
            <li className="flex gap-2">
              <svg width="20" height="13" viewBox="-2 0 30 19" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" className="size-5 shrink-0">
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
              <FeatureItem label={gearMap[gearbox] ?? gearbox} />
            </li>
            {year != null && (
              <li className="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5 shrink-0">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
                <FeatureItem label={String(year)} />
              </li>
            )}
            {mileage != null && (
              <li className="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.34 15a9 9 0 1 1 17.32 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 12 9.5 7.5" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                </svg>
                <FeatureItem label={`${fmt(mileage)} km`} />
              </li>
            )}
          </ul>

          {features && features.length > 0 && (
            <ul className="flex flex-col gap-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-textcolor text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-logoblue shrink-0" />
                  {f[locale]}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Prices row */}
        <div className="flex ml-auto flex-col gap-1 pb-6">
          <div className="">
            {pricePerDay != null && (
              <div className="flex items-baseline">
                <div className="grow">
                  <span className="grow text-textcolor text-sm ">{content.pricePerDay[locale]}:</span>
                </div>
                <span className="text-logoblue text-2xl font-semibold">{fmt(pricePerDay)}</span>
                <span className="text-textcolor text-sm">NOK</span>
              </div>
            )}
            {price != null && (
              <div className="flex items-baseline">
                <div className="grow">
                  <span className="grow text-textcolor text-sm ">{content.price[locale]}:</span>
                </div>
                <span className="text-logoblue text-2xl font-semibold">{fmt(price)}</span>
                <span className="text-textcolor text-sm">NOK</span>
              </div>
            )}
          </div>
          {listingType === "rental" && extraKmPrice != null && (
            <span className="text-textColorThird text-sm">
              {fmt(extraKmPrice)} NOK {content.extraKm[locale]}
            </span>
          )}
        </div>

        <Link href={`/bil-utleie/${id}`} className="customButtonEnabled w-full h-10 hidden lg:flex items-center justify-center">
          {content.order[locale]}
        </Link>
      </div>

      <div className="relative lg:hidden ">
        <Link href={`/bil-utleie/${id}`} className="customButtonEnabled w-full h-10 flex lg:hidden items-center justify-center">
          {content.order[locale]}
        </Link>
      </div>
    </div>
  );
};

const FeatureItem: React.FC<{ label: string }> = ({ label }) => <span className="text-textcolor">{label}</span>;

export default VehicleCard;
