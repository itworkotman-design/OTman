"use client";

import { useState, useRef, useEffect } from "react";
import VehicleCard from "@/app/_components/site/VehicleRental/VehicleCard";
import { vehicles } from "@/lib/vehicles";
import { CarRentalContent } from "@/lib/content/CarRentalContent";

type Locale = "en" | "no";
type PageTypes = {
  content: typeof CarRentalContent;
  locale: Locale;
};

const DEFAULT_FILTERS = {
  fuelType: "0",
  vehicleType: "0",
  gearbox: "0",
  location: "0",
  year: "0",
  sort: "lowest",
};

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
};
const gearMap: Record<string, string> = {
  "1": "Automatic",
  "2": "Manual",
};

function applyFilterLogic(
  f: typeof DEFAULT_FILTERS
): typeof vehicles {
  return vehicles.filter((v) => {
    if (f.fuelType !== "0" && v.fuelType !== fuelMap[f.fuelType]) return false;
    if (
      f.vehicleType !== "0" &&
      !v.vehicleType
        .toLowerCase()
        .includes(typeMap[f.vehicleType].toLowerCase())
    )
      return false;
    if (f.gearbox !== "0" && v.gearbox !== gearMap[f.gearbox]) return false;
    if (f.location !== "0" && v.location !== f.location) return false;
    if (f.year !== "0" && v.year !== Number(f.year)) return false;
    return true;
  });
}

type FilterOption = { value: string; label: string };

function FilterSection({
  title,
  options,
  selected,
  filterKey,
  filters,
  onToggle,
}: {
  title: string;
  options: FilterOption[];
  selected: string;
  filterKey: "fuelType" | "vehicleType" | "gearbox" | "location" | "year";
  filters: typeof DEFAULT_FILTERS;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-textcolor mb-2 uppercase tracking-wide">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {options.map(({ value, label }) => {
          const isSelected = selected === value;
          const hypothetical = applyFilterLogic({ ...filters, [filterKey]: value });
          const count = hypothetical.length;
          const isZero = count === 0;

          return (
            <button
              key={value}
              onClick={() => onToggle(value)}
              disabled={isZero && !isSelected}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-left transition-colors ${
                isSelected
                  ? "bg-lineSecondary/15 text-lineSecondary"
                  : isZero
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-textcolor hover:bg-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "bg-lineSecondary border-lineSecondary"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <svg
                      viewBox="0 0 10 8"
                      fill="none"
                      className="w-2.5 h-2.5"
                    >
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                {label}
              </span>
              <span
                className={`text-xs font-medium tabular-nums ${
                  isZero ? "text-gray-300" : "text-gray-400"
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CarRentalPage({ content, locale }: PageTypes) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const update = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const toggle = (key: "fuelType" | "vehicleType" | "gearbox" | "location" | "year", value: string) =>
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? "0" : value }));

  const reset = () => setFilters(DEFAULT_FILTERS);

  let filtered = applyFilterLogic(filters);
  const getPrice = (v: (typeof filtered)[0]) => v.pricePerDay ?? 0;
  filtered = [...filtered].sort((a, b) =>
    filters.sort === "lowest"
      ? getPrice(a) - getPrice(b)
      : getPrice(b) - getPrice(a)
  );

  const activeFilterCount = [
    filters.fuelType,
    filters.vehicleType,
    filters.gearbox,
    filters.location,
    filters.year,
  ].filter((v) => v !== "0").length;

  const fuelOptions: FilterOption[] = [
    { value: "1", label: content.electric[locale] },
    { value: "2", label: content.diesel[locale] },
    { value: "3", label: content.petrol[locale] },
    { value: "4", label: content.hybrid[locale] },
    { value: "5", label: content.gas[locale] },
  ];
  const typeOptions: FilterOption[] = [
    { value: "1", label: content.smallCar[locale] },
    { value: "2", label: content.familyCar[locale] },
    { value: "3", label: content.suv[locale] },
    { value: "4", label: content.van[locale] },
  ];
  const gearOptions: FilterOption[] = [
    { value: "1", label: content.automatic[locale] },
    { value: "2", label: content.manual[locale] },
  ];
  const locationOptions: FilterOption[] = [
    ...new Set(vehicles.map((v) => v.location).filter((l): l is string => !!l)),
  ]
    .sort()
    .map((loc) => ({ value: loc, label: loc }));
  const yearOptions: FilterOption[] = [
    ...new Set(vehicles.map((v) => String(v.year)).filter((y) => y !== "undefined")),
  ]
    .sort((a, b) => Number(b) - Number(a))
    .map((yr) => ({ value: yr, label: yr }));

  return (
    <div className="mt-10">
      <h1 className="sr-only">{content.pageTitle[locale]}</h1>
      <div className="flex mb-6 items-center gap-4">
        {/* Filters button + panel */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
              panelOpen || activeFilterCount > 0
                ? "border-lineSecondary text-lineSecondary bg-lineSecondary/10"
                : "border-gray-300 text-textcolor hover:border-gray-400"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-4 h-4"
            >
              <path
                d="M3 5h14M6 10h8M9 15h2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-medium text-sm">{content.filters[locale]}</span>
            {activeFilterCount > 0 && (
              <span className="bg-lineSecondary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {panelOpen && (
            <div className="absolute left-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 z-50 w-72 max-h-[80dvh] overflow-y-auto">
              <FilterSection
                title={content.fuelType[locale]}
                options={fuelOptions}
                selected={filters.fuelType}
                filterKey="fuelType"
                filters={filters}
                onToggle={(v) => toggle("fuelType", v)}
              />
              <div className="border-t border-gray-100 my-1" />
              <FilterSection
                title={content.carType[locale]}
                options={typeOptions}
                selected={filters.vehicleType}
                filterKey="vehicleType"
                filters={filters}
                onToggle={(v) => toggle("vehicleType", v)}
              />
              <div className="border-t border-gray-100 my-1" />
              <FilterSection
                title={content.specGearbox[locale]}
                options={gearOptions}
                selected={filters.gearbox}
                filterKey="gearbox"
                filters={filters}
                onToggle={(v) => toggle("gearbox", v)}
              />
              <div className="border-t border-gray-100 my-1" />
              <FilterSection
                title={content.specLocation[locale]}
                options={locationOptions}
                selected={filters.location}
                filterKey="location"
                filters={filters}
                onToggle={(v) => toggle("location", v)}
              />
              <div className="border-t border-gray-100 my-1" />
              <FilterSection
                title={content.specYear[locale]}
                options={yearOptions}
                selected={filters.year}
                filterKey="year"
                filters={filters}
                onToggle={(v) => toggle("year", v)}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={reset}
                  className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
                >
                  {content.reset[locale]}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">{content.sort[locale]}:</span>
          <select
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value)}
            className="customInput w-35 text-center! pl-0! rounded-full! appearance-none"
          >
            <option value="lowest">{content.sortValueLowest[locale]}</option>
            <option value="highest">{content.sortValueHighest[locale]}</option>
          </select>
        </div>

        <div className="flex-1 text-right text-lineSecondary">
          <p>
            {content.vehiclesFound[locale]} {filtered.length}
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col items-center gap-10 w-full mb-10">
        {filtered.length > 0 ? (
          filtered.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              {...vehicle}
              locale={locale}
              content={content}
            />
          ))
        ) : (
          <p className="text-textcolor py-20">
            {content.noVehicleFound[locale]}
          </p>
        )}
      </div>
    </div>
  );
}
