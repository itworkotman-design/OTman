"use client"
import Image from "next/image";
import React from "react";
import Link from "next/link";

export interface VehicleProps {
  id: number;
  name: string;
  imageUrl: string;
  images: string[];
  description: string;
  seats: number;
  fuelType: string;
  vehicleType: string;
  gearbox: string;
  extraKmPrice: number;
  pricePerDay: number;
}

const VehicleCard: React.FC<VehicleProps> = ({
  id,
  name,
  imageUrl,
  seats,
  fuelType,
  vehicleType,
  gearbox,
  extraKmPrice,
  pricePerDay,
}) => {

  const carTypeIcons = {
    Car: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>,
    Van: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5"><path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"/><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
  }
  const normalizedVehicleType = vehicleType.toLowerCase();
  const selectedCarType =
    normalizedVehicleType.includes("van") ? "Van" : "Car";

  return (
    <div className="relative left-0 w-full flex flex-col lg:flex-row customContainer gap-4 lg:gap-10">
      
        <div className="relative w-full min-h-[250] lg:min-h-[400] lg:flex-1 order-2 lg:order-1 bg-amber-100 rounded-2xl overflow-hidden">
          <Link href={`/bil-utleie/${id}`} className="absolute inset-0 block">
            <Image src={imageUrl} fill alt="Vehicle img" className="object-cover" />
          </Link>
        </div>
      

      <div className="flex flex-1 flex-col order-1 lg:order-2">
        <h2 className="text-logoblue text-center text-3xl font-semibold mb-10">
          {name}
        </h2>

        <div className="lg:flex flex-1">
          <div className="flex-1">
            <ul className="flex gap-4 lg: flex-wrap lg:block pb-10 lg:pb-0">
              <li className="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                <FeatureItem label={`${seats}`} />
              </li>
              <li className="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5"><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/></svg>
                <FeatureItem label={`${fuelType}`} />
              </li>
              <li className="flex gap-2">
                <span>{carTypeIcons[selectedCarType]}</span>
                <FeatureItem label={vehicleType} />
              </li>
              <li className="flex gap-2">
                <svg width="20" height="13" viewBox="-2 0 30 19" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" className="size-5">
                  <circle cx="22.2858" cy="1.71429" r="1.71429" />
                  <circle cx="8.57147" cy="1.71429" r="1.71429" />
                  <circle cx="1.71429" cy="1.71429" r="1.71429" />
                  <circle cx="8.57147" cy="16.4575" r="1.71429" />
                  <circle cx="15.4286" cy="16.4575" r="1.71429" />
                  <circle cx="22.2858" cy="16.4575" r="1.71429" />
                  <line x1="8.38574" y1="2.21387" x2="8.38574" y2="16.9853"/>
                  <line x1="22.1001" y1="2.21387" x2="22.1001" y2="16.9853"/>
                  <path d="M1.71411 1.02832V5.99976C1.71411 8.39976 3.1884 9.59977 4.97126 9.59977C6.75412 9.59977 17.0284 9.59977 22.457 9.59977"/>
                  <line x1="15.5" y1="2.21387" x2="15.5" y2="16.9853"/>
                  <circle cx="15.7143" cy="1.71429" r="1.71429" />
                </svg>
                <FeatureItem label={gearbox} />
              </li>
              <li className="flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-5"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>
                <FeatureItem label={`${extraKmPrice}kr per extra km`} />
              </li>
            </ul>
          </div>

          <div className="flex-1 flex justify-end items-end">
            <div className="flex items-center">
              <span className="text-textcolor pr-4">Price per day:</span>
              <div className="flex items-end">
                <span className="text-logoblue text-4xl font-semibold">
              {pricePerDay}
              </span>
              <span className="text-textcolor pl-1">kr</span>
              </div>
              
            </div>
          </div>
        </div>
        <Link href={`/bil-utleie/${id}`} className="customButtonDefault w-full h-10 flex items-center justify-center">
            Order
          </Link>
      </div>
      <div className="relative lg:hidden order-3">
        <div className="relative lg:hidden order-3">
          <Link href={`/bil-utleie/${id}`} className="customButtonDefault w-full h-10 flex items-center justify-center">
            Order
          </Link>
        </div>
      </div>
    </div>
  );
};

const FeatureItem: React.FC<{ label: string }> = ({ label }) => (
    <span className="text-textcolor">{label}</span>
);

export default VehicleCard;