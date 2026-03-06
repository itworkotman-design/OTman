import VehicleCard, { VehicleProps } from "@/app/_components/site/VehicleRental/VehicleCard";

const vehicles: VehicleProps[] = [
  {
    name: "VW Crafter 11m3",
    imageUrl: "/images/vw-crafter.png",
    seats: 3,
    fuelType: "Diesel",
    vehicleType: "Varibit",
    gearbox: "Automat",
    extraKmPrice: 4,
    pricePerDay: 540,
    currency: "kr",
  },
  {
    name: "VW Crafter 11m3",
    imageUrl: "/images/vw-crafter.png",
    seats: 3,
    fuelType: "Diesel",
    vehicleType: "Varibit",
    gearbox: "Automat",
    extraKmPrice: 4,
    pricePerDay: 540,
    currency: "kr",
  },
];

export default function VehicleWindow() {
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {vehicles.map((vehicle, index) => (
        <VehicleCard key={index} {...vehicle} />
      ))}
    </div>
  );
}