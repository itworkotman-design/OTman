import VehicleWindow from "@/app/_components/site/VehicleRental/VehicleWindow";

export default function Bilutleie() {
  return (
    <section>
      <div className="py-16">
        <h1 className="text-logoblue text-[40px] md:text-[48px] font-bold justify-self-center">
          Vehicle Rental
        </h1>
      </div>
      <div>
        <VehicleWindow />
      </div>
    </section>
  );
}