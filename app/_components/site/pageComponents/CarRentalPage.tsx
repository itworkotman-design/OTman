"use client";

import { useState } from "react";
import VehicleCard from "@/app/_components/site/VehicleRental/VehicleCard";
import { vehicles } from "@/lib/vehicles";
import { CarRentalContent } from "@/lib/content/CarRentalContent";

type Locale = "en" | "no";
type PageTypes = {
  content: typeof CarRentalContent;
  locale: Locale;
}

const DEFAULT_FILTERS = {
  seats: "0",
  fuelType: "0",
  vehicleType: "0",
  gearbox: "0",
  sort: "lowest",
};

export default function CarRentalPage({content, locale}: PageTypes) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);

  const update = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const applyFilters = () => setApplied(filters);

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  };

  const seatMap: Record<string, number> = { "1": 2, "2": 3, "3": 5, "4": 7 };
  const fuelMap: Record<string, string> = {
    "1": "Electric",
    "2": "Diesel",
    "3": "Petrol",
    "4": "Hybrid",
    "5": "Gas",
  };
  const typeMap: Record<string, string> = {
    "1": "Small car",
    "2": "Family car",
    "3": "SUV",
    "4": "Van",
    "5": "Cargo van",
  };
  const gearMap: Record<string, string> = {
    "1": "Automatic",
    "2": "Manual",
  };

  let filtered = vehicles.filter((v) => {
    if (applied.seats !== "0" && v.seats !== seatMap[applied.seats])
      return false;
    if (applied.fuelType !== "0" && v.fuelType !== fuelMap[applied.fuelType])
      return false;
    if (
      applied.vehicleType !== "0" &&
      !v.vehicleType
        .toLowerCase()
        .includes(typeMap[applied.vehicleType].toLowerCase())
    )
      return false;
    if (applied.gearbox !== "0" && v.gearbox !== gearMap[applied.gearbox])
      return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) =>
    applied.sort === "lowest"
      ? a.pricePerDay - b.pricePerDay
      : b.pricePerDay - a.pricePerDay
  );

  return (
    <div className="mt-10">
      {/* Filter bar */}
      <div className="flex mb-4 items-end">
        <div className="flex-1 text-lineSecondary items-end">
          <h2>{content.vehiclesFound[locale]}{filtered.length}</h2>
        </div>
        <div className="flex-1 flex justify-end items-center">
          <h2 className="mr-2">{content.sort[locale]}:</h2>
          <select
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value)}
            className="customInput w-[140] text-center! pl-0! rounded-full! appearance-none"
          >
            <option value="lowest">{content.sortValueHighest[locale]}</option>
            <option value="highest">{content.sortValueLowest[locale]}</option>
          </select>
        </div>
      </div>

      <div className="flex mb-4 items-end">
        <div className="flex flex-wrap lg:flex-row items-center gap-8 customContainer w-full">
          <div className="w-full lg:w-auto">
            <label className="pr-2 text-textcolor">{content.carSeats[locale]}:</label>
            <select
              value={filters.seats}
              onChange={(e) => update("seats", e.target.value)}
              className="px-2 customInput w-full lg:w-auto appearance-none"
            >
              <option value="0">{content.choose[locale]}</option>
              <option value="1">2</option>
              <option value="2">3</option>
              <option value="3">5</option>
              <option value="4">7</option>
            </select>
          </div>

          <div className="w-full lg:w-auto">
            <label className="pr-2 text-textcolor">{content.fuelType[locale]}:</label>
            <select
              value={filters.fuelType}
              onChange={(e) => update("fuelType", e.target.value)}
              className="px-2 customInput w-full lg:w-auto appearance-none"
            >
              <option value="0">{content.choose[locale]}</option>
              <option value="1">{content.electric[locale]}</option>
              <option value="2">{content.diesel[locale]}</option>
              <option value="3">{content.petrol[locale]}</option>
              <option value="4">{content.hybrid[locale]}</option>
              <option value="5">{content.gas[locale]}</option>
            </select>
          </div>

          <div className="w-full lg:w-auto">
            <label className="pr-2 text-textcolor">{content.carType[locale]}:</label>
            <select
              value={filters.vehicleType}
              onChange={(e) => update("vehicleType", e.target.value)}
              className="px-2 customInput w-full lg:w-auto appearance-none"
            >
              <option value="0">{content.choose[locale]}</option>
              <option value="1">Small car</option>
              <option value="2">Family car</option>
              <option value="3">SUV</option>
              <option value="4">Van</option>
              <option value="5">Cargo van</option>
            </select>
          </div>

          <div className="w-full lg:w-auto">
            <label className="pr-2 text-textcolor">Gear box:</label>
            <select
              value={filters.gearbox}
              onChange={(e) => update("gearbox", e.target.value)}
              className="px-2 customInput w-full lg:w-auto appearance-none"
            >
              <option value="0">{content.choose[locale]}</option>
              <option value="1">Automatic</option>
              <option value="2">Manual</option>
            </select>
          </div>

          <div className="flex gap-4 ml-auto">
            <button onClick={applyFilters} className="customButtonEnabled">
              Apply filters
            </button>
            <button onClick={reset} className="customButtonDefault">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col items-center gap-10 w-full mb-10">
        {filtered.length > 0 ? (
          filtered.map((vehicle) => (
            <VehicleCard key={vehicle.id} {...vehicle} />
          ))
        ) : (
          <p className="text-textcolor py-20">
            No vehicles match your filters.
          </p>
        )}
      </div>
    </div>
  );
}