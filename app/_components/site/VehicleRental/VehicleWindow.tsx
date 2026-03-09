import VehicleCard from "@/app/_components/site/VehicleRental/VehicleCard";
import { vehicles } from "@/lib/vehicles";

export default function VehicleWindow() {
  return (
    <div className="flex flex-col items-center gap-10 w-full mb-10">
      {vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} {...vehicle} />
      ))}
    </div>
  );
}