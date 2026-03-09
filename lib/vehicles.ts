import { VehicleProps } from "@/app/_components/site/VehicleRental/VehicleCard";

export const vehicles: VehicleProps[] = [
  {
    id: 1,
    name: "VW Crafter 11m3",
    imageUrl: "/Vehicle_default_crafter.jpg",
    images: [
      "/Vehicle_default_crafter.jpg",
      "/images/vw-crafter-side.png",
      "/images/vw-crafter-interior.png",
      "/images/vw-crafter-cargo.png",
    ],
    description:
      "The VW Crafter 11m³ is our most popular large cargo van, ideal for moving furniture, equipment, or anything that needs serious space. With an 11 cubic metre load area, a full automatic gearbox, and a reliable diesel engine, this van handles long hauls and city runs equally well. Perfect for businesses and individuals who need a dependable workhorse without sacrificing comfort.",
    seats: 3,
    fuelType: "Diesel",
    vehicleType: "Car",
    gearbox: "Automatic",
    extraKmPrice: 4,
    pricePerDay: 540,
  },
  {
    id: 2,
    name: "VW 2m3",
    imageUrl: "/Vehicle_default_caddy.jpg",
    images: [
      "/Vehicle_default_caddy.jpg",
      "/images/vw-crafter-side.png",
      "/images/vw-crafter-interior.png",
    ],
    description:
      "The VW 2m³ is a compact and nimble van that fits into tight city streets and small parking spaces without any fuss. Despite its smaller footprint, it offers a surprisingly practical 2 cubic metre cargo area — great for smaller deliveries, courier runs, or light moves. Fuel-efficient and easy to drive with a manual gearbox.",
    seats: 3,
    fuelType: "Diesel",
    vehicleType: "Van",
    gearbox: "Manual",
    extraKmPrice: 2,
    pricePerDay: 800,
  },
];