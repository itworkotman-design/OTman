import VehicleWindow from "@/app/_components/site/VehicleRental/VehicleWindow";

export default function Bilutleie () {
    return(        
        <section>
            <div className="py-16">
                <h1 className="text-logoblue text-[40px] md:text-[48px] font-bold justify-self-center">Vehicle Rental</h1>
            </div>
            <div>
                <div className="flex mb-4 items-end">
                    <div className="flex-1 text-lineSecondary items-end">
                        <h2>Vehicles found: 20</h2>
                    </div>
                    <div className="flex-1 flex justify-end items-center">
                        <h2 className="mr-2">Sort:</h2>
                        <select name="" id="" className="customInput w-[140] text-center! pl-0! rounded-full! appearance-none">
                            <option value="">Lowest price</option>
                            <option value="">Highest price</option>
                        </select>
                    </div> 
                </div>
                <div className="flex mb-4 items-end">
                    <div className="flex items-center gap-8 customContainer w-full">
                        <div>
                            <label htmlFor="" className="pr-2 text-textcolor">Car seats:</label>
                            <select className="px-2 customInput appearance-none">
                                <option value="0" defaultChecked>Choose</option>
                                <option value="1">2</option>
                                <option value="2">3</option>
                                <option value="3">5</option>
                                <option value="4">7</option>
                            </select>   
                        </div>
                        <div>
                            <label htmlFor="" className="pr-2 text-textcolor">Fuel Type:</label>
                            <select className="px-2 customInput appearance-none">
                                <option value="0" defaultChecked>Choose</option>
                                <option value="1">Electric</option>
                                <option value="2">Diesel</option>
                                <option value="3">Petrol</option>
                                <option value="4">Hybrid</option>
                                <option value="5">Gas</option>
                            </select>   
                        </div>
                        <div>
                            <label htmlFor="" className="pr-2 text-textcolor">Car Type:</label>
                            <select className="px-2 customInput appearance-none">
                                <option value="0" defaultChecked>Choose</option>
                                <option value="1">Small car</option>
                                <option value="2">Family car</option>
                                <option value="3">SUV</option>
                                <option value="4">Van</option>
                                <option value="5">Cargo van</option>
                            </select>   
                        </div>
                        <div>
                            <label htmlFor="" className="pr-2 text-textcolor">Gear box:</label>
                            <select className="px-2 customInput appearance-none">
                                <option value="0" defaultChecked>Choose</option>
                                <option value="1">Automatic</option>
                                <option value="2">Manual</option>
                            </select>   
                        </div> 
                        <div className="flex gap-4 ml-auto">
                           <button className="customButtonEnabled">Apply filters</button>
                           <button className="customButtonDefault">Reset</button>
                        </div>
                    </div>
                </div>
                <VehicleWindow/>
            </div>
        </section>

    )
}