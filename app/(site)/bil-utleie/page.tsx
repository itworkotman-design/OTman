import VehicleWindow from "@/app/_components/site/VehicleRental/VehicleWindow";
import Image from "next/image";

export default function Bilutleie () {
    return(        
        <section>
            <div className="py-16">
                <h1 className="text-logoblue text-[40px] md:text-[48px] font-bold justify-self-center">Vehicle Rental</h1>
            </div>
            <div>
                <div className="flex mb-4">
                    <div className="flex-1"><h2>Biler funnet: 20</h2></div>
                    <div className="flex-1 flex justify-end items-center">
                        <h2 className="mr-2">Sorter:</h2>
                        <select name="" id="" className="customInput w-[180]">
                            <option value="">Fra biligst</option>
                            <option value="">Fra dyrest</option>
                        </select>
                    </div>   
                </div>
                <VehicleWindow/>
            </div>
        </section>

    )
}