import { notFound } from "next/navigation";
import Link from "next/link";
import { vehicles } from "@/lib/vehicles";
import VehicleGallery from "@/app/_components/site/VehicleRental/VehicleGallery";
import { CarRentalContent } from "@/lib/content/CarRentalContent";

type Locale = "en" | "no";

type Props = {
  params: Promise<{ id: string; locale: Locale }>;
};

export default async function CarRentalDetailsPage({ params }: Props) {
  const { id, locale } = await params;
  const vehicle = vehicles.find((v) => v.id === Number(id));

  if (!vehicle) {
    notFound();
  }

  const c = CarRentalContent;

  const fuelMap: Record<string, string> = {
    Electric: c.electric[locale],
    Diesel:   c.diesel[locale],
    Petrol:   c.petrol[locale],
    Hybrid:   c.hybrid[locale],
    Gas:      c.gas[locale],
  };

  const typeMap: Record<string, string> = {
    "Small car":  c.smallCar[locale],
    "Family car": c.familyCar[locale],
    SUV:          c.suv[locale],
    Van:          c.van[locale],
  };

  const gearMap: Record<string, string> = {
    Automatic: c.automatic[locale],
    Manual:    c.manual[locale],
  };

  const {
    name,
    images,
    description,
    seats,
    fuelType,
    vehicleType,
    gearbox,
    extraKmPrice,
    pricePerDay,
  } = vehicle;

  return (
    <section>
      <div className="py-16">
        <h1 className="text-logoblue text-5xl font-bold justify-self-center text-center">
          {name}
        </h1>
      </div>

      <div className="lg:customContainer flex flex-col gap-10 mb-16">
        <div>
          <div className="mb-2">
            <Link href="/bil-utleie" className="text-center text-sm text-textcolor hover:text-logoblue transition">
              {c.backToVehicles[locale]}
            </Link>
          </div>
          <VehicleGallery images={images} name={name} />
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1">
            <h2 className="text-logoblue text-2xl font-semibold mb-4">
              {c.aboutVehicle[locale]}
            </h2>
            <p className="text-textcolor leading-relaxed">{description}</p>
          </div>

          <div className="lg:w-72 flex flex-col gap-6">
            <div className="customContainer rounded-2xl p-6 flex flex-col gap-3 border border-lineSecondary">
              <h2 className="text-logoblue text-xl font-semibold mb-2">
                {c.specifications[locale]}
              </h2>
              <SpecRow label={c.specSeats[locale]}       value={`${seats} ${c.seats[locale]}`} />
              <SpecRow label={c.specFuelType[locale]}    value={fuelMap[fuelType] ?? fuelType} />
              <SpecRow label={c.specVehicleType[locale]} value={typeMap[vehicleType] ?? vehicleType} />
              <SpecRow label={c.specGearbox[locale]}     value={gearMap[gearbox] ?? gearbox} />
              <SpecRow label={c.specExtraKm[locale]}     value={`${extraKmPrice} kr/km`} />
            </div>

            <div className="customContainer rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-end gap-2">
                <span className="text-textcolor">{c.pricePerDay[locale]}:</span>
                <span className="text-logoblue text-4xl font-semibold leading-none">
                  {pricePerDay}
                </span>
                <span className="text-textcolor">kr</span>
              </div>
              <button className="customButtonEnabled lg:w-full h-10">
                {c.orderNow[locale]}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-textcolor">{label}</span>
      <span className="text-logoblue font-medium">{value}</span>
    </div>
  );
}