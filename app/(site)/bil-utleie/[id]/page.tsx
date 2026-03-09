import { notFound } from "next/navigation";
import Link from "next/link";
import { vehicles } from "@/lib/vehicles";
import VehicleGallery from "@/app/_components/site/VehicleRental/VehicleGallery";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function VehicleDetailsPage({ params }: Props) {
  const { id } = await params;
  const vehicle = vehicles.find((v) => v.id === Number(id));

  if (!vehicle) {
    notFound();
  }

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

      <div className="customContainer flex flex-col gap-10 mb-16">
        <div>
          <div className="mb-2">
            <Link href="/bil-utleie" className="text-center text-sm text-textcolor hover:text-logoblue transition">← Back to all vehicles</Link>
          </div>
          <VehicleGallery images={images} name={name} />
        </div>
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1">
            <h2 className="text-logoblue text-2xl font-semibold mb-4">
              About this vehicle
            </h2>
            <p className="text-textcolor leading-relaxed">{description}</p>
          </div>

          <div className="lg:w-72 flex flex-col gap-6">
            <div className="customContainer rounded-2xl p-6 flex flex-col gap-3 border border-lineSecondary">
              <h2 className="text-logoblue text-xl font-semibold mb-2">
                Specifications
              </h2>
              <SpecRow label="Seats" value={`${seats}`} />
              <SpecRow label="Fuel type" value={fuelType} />
              <SpecRow label="Vehicle type" value={vehicleType} />
              <SpecRow label="Gearbox" value={gearbox} />
              <SpecRow label="Extra km price" value={`${extraKmPrice} kr/km`} />
            </div>

            <div className="customContainer rounded-2xl p-6 border border-lineSecondary flex flex-col gap-4">
              <div className="flex items-end gap-2">
                <span className="text-textcolor">Price per day:</span>
                <span className="text-logoblue text-4xl font-semibold leading-none">
                  {pricePerDay}
                </span>
                <span className="text-textcolor">kr</span>
              </div>
              <button className="customButtonEnabled w-full h-10">
                Order now
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