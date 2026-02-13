"use client"
import { useState } from "react";
import { ProductCard } from "@/app/_components/(Dahsboard)/(booking)/create/ProductCard";
import { PickupLocations } from "@/app/_components/(Dahsboard)/(booking)/create/PickupLocations";
import { CalculatorDisplay } from "@/app/_components/(Dahsboard)/(booking)/create/CalculatorDisplay";
import { PRICE_ITEMS } from "@/lib/pricing";

function calculateTotal(keys: string[]) {
  let total = 0;
  let foundAny = false;
  let onlyReturns = true;

  for (const key of keys) {
    const item = PRICE_ITEMS.find(i => i.key === key);
    if (!item) continue;

    foundAny = true;
    if (item.category !== "return") onlyReturns = false;

    total += item.customerPrice;
  }

  if (!foundAny) return 0;
  if (onlyReturns) return 0; // "Kun return" rule

  return total;
}

export default function CreatePage(){
    const [cards, setCards] = useState([0])
    const [phone, setPhone] = useState("+47 ");
    const [phoneTwo, setPhoneTwo] = useState("+47 ");
    const [phoneThree, setPhoneThree] = useState("+47 ");

    const [cardKeys, setCardKeys] = useState<Record<number, string[]>>({});
    const total = calculateTotal(Object.values(cardKeys).flat());

    const addCard = () => {
        setCards((prev) => [...prev, prev.length]);
    }

    return (
        <>
        <main className="flex">
            <div className="w-full max-w-xl">
                {cards.map((id) => (<ProductCard key={id} cardId={id} onChange={(keys) => setCardKeys((prev) => ({ ...prev, [id]: keys }))}/>))}
            <button
                type="button"
                className="my-8 w-full font-bold cursor-pointer border-2 border-logoblue text-logoblue py-3 px-4 rounded-xl hover:bg-logoblue hover:text-white"
                onClick={addCard}
                >
                Add extra products
            </button>

            <button className="my-8 w-full font-bold cursor-pointer border-2 border-logoblue text-logoblue py-3 px-4 rounded-xl hover:bg-logoblue hover:text-white" onClick={addCard}>Add extra products</button>
                <div className="">
                    <h1 className="font-bold py-2">Order number</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Description</h1>
                    <input className="w-full py-2 px-4 h-30 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Delivery date</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Delivery Time window</h1>
                    <select className="w-full py-2 px-2 rounded-xl border">
                        <option value="disabled" aria-disabled>Choose</option>
                        <option value="morning">10:00-16:00</option>
                        <option value="afternoon">16:00-21:00</option>
                        <option value="contact">Contact client</option>
                    </select>

                    <PickupLocations/>

                    <h1 className="font-bold py-2">Delivery address</h1>
                    <input className="w-full py-2 px-4 rounded-xl border" placeholder="Enter a location"></input>

                    <h1 className="font-bold py-2">Total driving distance</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Customer&apos;s name</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Customer&apos;s phone</h1>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border px-4 py-2 outline-none"></input>

                    <h1 className="font-bold py-2">Additional customer&apos;s phone</h1>
                    <input type="tel" value={phoneTwo} onChange={(e) => setPhoneTwo(e.target.value)} className="w-full rounded-xl border px-4 py-2 outline-none"></input>

                    <h1 className="font-bold py-2">Customer&apos;s email</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Customer comments</h1>
                    <input className="w-full py-2 px-4 h-30 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Floor No.</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Lift</h1>
                    <input className="inline mr-2" type="radio" name="lift"/><p className="inline">Yes</p>
                    <input className="inline ml-4 mr-2" type="radio" name="lift"/><p className="inline">No</p>

                    <h1 className="font-bold py-2">Cashier&apos;s name</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Cashier&apos;s phone</h1>
                    <input type="tel" value={phoneThree} onChange={(e) => setPhoneThree(e.target.value)} className="w-full rounded-xl border px-4 py-2 outline-none"></input>

                    {/*TODO: Fix to automatic*/}
                    <h1 className="font-bold py-2">Subcontractor</h1>
                    <select className="w-full py-2 px-2 rounded-xl border">
                        <option aria-disabled >Choose</option>
                        <option >Otman Transport AS</option>
                        <option >Bahs Courier</option>
                        <option >Nordline AS</option>
                        <option >Tastanovas Grocery Store</option>
                        <option >Viken Trotting Sport Tanha</option>
                        <option >Levitis Transport</option>
                        <option >Arnosan AS</option>
                        <option >Stombergas Transport</option>
                        <option >Construction Service Vaicuss</option>
                        <option >New subcontractor 1</option>
                        <option >New subcontractor 2</option>
                    </select>

                    <h1 className="font-bold py-2">Driver</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Second driver</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">Info for the driver</h1>
                    <input className="w-full py-2 px-4 h-30 rounded-xl border"></input>

                    <h1 className="font-bold py-2">License plate</h1>
                    <input className="w-full py-2 px-4 rounded-xl border"></input>

                    <h1 className="font-bold py-2">??????</h1>
                    <select className="w-full py-2 px-2 rounded-xl border">
                        <option aria-disabled >Choose</option>
                        <option >Deviation, missed trip; Customer not at home</option>
                        <option >Deviation, dead end; Customer cancelled</option>
                        <option >Deviation, missed delivery; Damaged goods</option>
                        <option >Deviation, delivery toll stairs; Wrong item</option>
                        <option >Deviation, toll; Wrong address</option>
                        <option >Deviation, toll trip; New driving date</option>
                        <option >Deviation, missed trip; Warehouse cannot find the product</option>
                        <option >Deviation, toll trip; Cancelled the day before</option>
                    </select>
                    <div className="pt-2">
                        <input type="checkbox" className="inline"/><p className="inline pl-2">Fee for extra work per started</p>
                    </div>
                    <div className="pt-2">
                        <input type="checkbox" className="inline"/><p className="inline pl-2">Fee for adding to order</p>
                    </div>

                    <h1 className="font-bold py-2">Status notes</h1>
                    <input className="w-full py-2 px-4 h-30 rounded-xl border"></input>
                    
                    {/*TODO: Fix to automatic*/}
                    <h1 className="font-bold py-2">Change customer</h1>
                    <select className="w-full py-2 px-2 rounded-xl border">
                        <option aria-disabled >Choose</option>
                        <option >Power this</option>
                        <option >Power that</option>
                    </select>

                    <h1 className="font-bold py-2">Status</h1>
                    <select className="w-full py-2 px-2 rounded-xl border">
                        <option aria-disabled >Choose</option>
                        <option ></option>
                        <option >Behandles</option>
                        <option >Bekreftet</option>
                        <option >Aktiv</option>
                        <option >Kanselert</option>
                        <option >Fail</option>
                        <option >Ferdig</option>
                        <option >Fakturert</option>
                        <option >Betalt</option>
                    </select>

                    {/*TODO: Fix add file*/}
                    <h1 className="font-bold py-2">Attachment</h1>

                    <input type="checkbox" className=" inline mr-2"/>
                    <p className="py-2 inline">Don&apos;t send email</p>
                

                    <button className="block w-full mb-20 mt-8 border-2 border-logoblue text-logoblue py-4 px-8 rounded-2xl cursor-pointer font-bold hover:bg-logoblue hover:text-white" type="submit">Submit</button>
                </div>
            </div>
            <div className="fixed left-230 top-32">
                <CalculatorDisplay total={total} />
            </div>
            
        </main>
        
            
        </>
    )
}