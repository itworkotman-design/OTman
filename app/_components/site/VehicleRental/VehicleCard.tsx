import Image from "next/image";
import React from "react";

export interface VehicleProps {
  name: string;
  imageUrl: string;
  seats: number;
  fuelType: string;
  vehicleType: string;
  gearbox: string;
  extraKmPrice: number;
  pricePerDay: number;
}

const VehicleCard: React.FC<VehicleProps> = ({
  name,
  imageUrl,
  seats,
  fuelType,
  vehicleType,
  gearbox,
  extraKmPrice,
  pricePerDay,
}) => {
  return (
    <div className="relative left-0 w-full flex customContainer gap-10">
      <div className="relative w-full h-[400] flex-1 bg-amber-100 rounded-2xl">
        <Image src={imageUrl} fill alt="bil bilde" className="object-cover" />
      </div>

      <div className="flex-1 flex flex-col">
        <h2 className="text-logoblue text-center text-3xl font-semibold mb-10">
          {name}
        </h2>

        <div className="flex flex-1">
          <div className="flex-1">
            <ul className="">
              <FeatureItem label={`${seats}`} />
              <FeatureItem label={`${fuelType}:`} />
              <FeatureItem label={vehicleType} />
              <FeatureItem label={gearbox} />
              <FeatureItem label={`${extraKmPrice}kr per extra km`} />
            </ul>
          </div>

          <div className="flex-1 flex justify-end items-end">
            <div className="flex items-center">
              <span className="text-textcolor pr-4">Pris per dag fra:</span>
              <div className="flex items-end">
                <span className="text-logoblue text-4xl font-semibold">
              {pricePerDay}
              </span>
              <span className="text-textcolor pl-1">kr</span>
              </div>
              
            </div>
          </div>
        </div>

        <button className="customButtonDefault w-full mt-4 h-10">Bestill</button>
      </div>
    </div>
  );
};

const FeatureItem: React.FC<{ label: string }> = ({ label }) => (
  <li className="py-2">
    <span />
    <span className="text-textcolor">{label}</span>
  </li>
);

export default VehicleCard;