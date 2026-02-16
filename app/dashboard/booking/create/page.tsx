"use client";

import { useMemo, useRef, useState } from "react";
import { ProductCard } from "@/app/_components/(Dahsboard)/(booking)/create/ProductCard";
import { PickupLocations } from "@/app/_components/(Dahsboard)/(booking)/create/PickupLocations";
import { CalculatorDisplay } from "@/app/_components/(Dahsboard)/(booking)/create/CalculatorDisplay";
import { PRICE_ITEMS } from "@/lib/pricing";
import { PRODUCTS } from "@/lib/products";
import type { DeliveryType, LineItem } from "@/app/_components/(Dahsboard)/(booking)/create/ProductCard";

// ============================================================================
// HELPERS
// ============================================================================

function codeToKey(code: string): string | null {
  return PRICE_ITEMS.find((i) => i.code === code)?.key ?? null;
}

// Order-level fees (charge max once per order)
const ORDER_LEVEL_KEYS = new Set<string>(
  ["DELIVERY", "INDOOR", "INSTALL"]
    .map(codeToKey)
    .filter((x): x is string => Boolean(x))
);

function calculateTotalFromCards(
  cardItems: Record<number, LineItem[]>,
  cardDeliveryType: Record<number, DeliveryType>
) {
  let total = 0;
  const seenOrderLevel = new Set<string>();

  for (const [cardIdStr, items] of Object.entries(cardItems)) {
    const cardId = Number(cardIdStr);

    // "Kun retur" rule: whole card contributes 0
    if (cardDeliveryType[cardId] === "Kun retur") continue;

    for (const it of items) {
      const price = PRICE_ITEMS.find((p) => p.key === it.key)?.customerPrice ?? 0;

      // Order-level fees: only once, qty forced to 1
      if (ORDER_LEVEL_KEYS.has(it.key)) {
        if (seenOrderLevel.has(it.key)) continue;
        seenOrderLevel.add(it.key);
        total += price * 1;
        continue;
      }

      total += price * it.qty;
    }
  }

  return total;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CreatePage() {
  const [cards, setCards] = useState<number[]>([0]);

  // never-repeating internal ids
  const nextCardId = useRef(1);

  const [phone, setPhone] = useState("+47 ");
  const [phoneTwo, setPhoneTwo] = useState("+47 ");
  const [phoneThree, setPhoneThree] = useState("+47 ");

  const [cardItems, setCardItems] = useState<Record<number, LineItem[]>>({});
  const [cardDeliveryType, setCardDeliveryType] = useState<Record<number, DeliveryType>>({});
  const [cardProducts, setCardProducts] = useState<Record<number, string | null>>({});

  const total = useMemo(
    () => calculateTotalFromCards(cardItems, cardDeliveryType),
    [cardItems, cardDeliveryType]
  );

  // Build product breakdowns for calculator display
  // (also dedupe order-level fees in the UI so they don't show under multiple products)
  const productBreakdowns = useMemo(() => {
    const seenOrderLevel = new Set<string>();

    return cards
      .map((cardId) => {
        const productId = cardProducts[cardId];
        const productName = productId
          ? PRODUCTS.find((p) => p.id === productId)?.label || "Unknown Product"
          : "No product selected";

        const rawItems = cardItems[cardId] || [];

        // Hide all items if this card is "Kun retur"
        const items =
          cardDeliveryType[cardId] === "Kun retur"
            ? []
            : rawItems.filter((it) => {
                if (!ORDER_LEVEL_KEYS.has(it.key)) return true;
                if (seenOrderLevel.has(it.key)) return false;
                seenOrderLevel.add(it.key);
                return true;
              });

        return { productName, items };
      })
      .filter((b) => b.items.length > 0 || b.productName !== "No product selected");
  }, [cards, cardProducts, cardItems, cardDeliveryType]);

  const addCard = () => {
    const id = nextCardId.current++;
    setCards((prev) => [...prev, id]);
  };

  const canRemove = cards.length > 1;

  const removeCard = (id: number) => {
    if (!canRemove) return;

    setCards((prev) => prev.filter((c) => c !== id));

    setCardItems((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    setCardDeliveryType((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    setCardProducts((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  return (
    <>
      <main className="flex">
        <div className="w-full max-w-xl">
          {/* Product Cards - dynamically rendered */}
          {cards.map((id, index) => (
            <ProductCard
              key={id}
              cardId={id}
              displayIndex={index + 1}
              onChange={({ items, deliveryType }) => {
                setCardItems((prev) => ({ ...prev, [id]: items }));
                setCardDeliveryType((prev) => ({ ...prev, [id]: deliveryType }));
              }}
              onProductChange={(productId) =>
                setCardProducts((prev) => ({ ...prev, [id]: productId }))
              }
              onRemove={removeCard}
              disableRemove={!canRemove}
            />
          ))}

          {/* Add Product Button */}
          <button
            type="button"
            className="my-8 w-full font-bold cursor-pointer border-2 border-logoblue text-logoblue py-3 px-4 rounded-xl hover:bg-logoblue hover:text-white"
            onClick={addCard}
          >
            Add extra products
          </button>

          {/* Order Form Fields */}
          <div className="">
            <h1 className="font-bold py-2">Order number</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Description</h1>
            <input className="w-full py-2 px-4 h-30 rounded-xl border" />

            <h1 className="font-bold py-2">Delivery date</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Delivery Time window</h1>
            <select className="w-full py-2 px-2 rounded-xl border">
              <option value="disabled" aria-disabled>
                Choose
              </option>
              <option value="morning">10:00-16:00</option>
              <option value="afternoon">16:00-21:00</option>
              <option value="contact">Contact client</option>
            </select>

            <PickupLocations />

            <h1 className="font-bold py-2">Delivery address</h1>
            <input className="w-full py-2 px-4 rounded-xl border" placeholder="Enter a location" />

            <h1 className="font-bold py-2">Total driving distance</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Customer&apos;s name</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Customer&apos;s phone</h1>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border px-4 py-2 outline-none"
            />

            <h1 className="font-bold py-2">Additional customer&apos;s phone</h1>
            <input
              type="tel"
              value={phoneTwo}
              onChange={(e) => setPhoneTwo(e.target.value)}
              className="w-full rounded-xl border px-4 py-2 outline-none"
            />

            <h1 className="font-bold py-2">Customer&apos;s email</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Customer comments</h1>
            <input className="w-full py-2 px-4 h-30 rounded-xl border" />

            <h1 className="font-bold py-2">Floor No.</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Lift</h1>
            <input className="inline mr-2" type="radio" name="lift" />
            <p className="inline">Yes</p>
            <input className="inline ml-4 mr-2" type="radio" name="lift" />
            <p className="inline">No</p>

            <h1 className="font-bold py-2">Cashier&apos;s name</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Cashier&apos;s phone</h1>
            <input
              type="tel"
              value={phoneThree}
              onChange={(e) => setPhoneThree(e.target.value)}
              className="w-full rounded-xl border px-4 py-2 outline-none"
            />

            <h1 className="font-bold py-2">Subcontractor</h1>
            <select className="w-full py-2 px-2 rounded-xl border">
              <option aria-disabled>Choose</option>
              <option>Otman Transport AS</option>
              <option>Bahs Courier</option>
              <option>Nordline AS</option>
              <option>Tastanovas Grocery Store</option>
              <option>Viken Trotting Sport Tanha</option>
              <option>Levitis Transport</option>
              <option>Arnosan AS</option>
              <option>Stombergas Transport</option>
              <option>Construction Service Vaicuss</option>
              <option>New subcontractor 1</option>
              <option>New subcontractor 2</option>
            </select>

            <h1 className="font-bold py-2">Driver</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Second driver</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">Info for the driver</h1>
            <input className="w-full py-2 px-4 h-30 rounded-xl border" />

            <h1 className="font-bold py-2">License plate</h1>
            <input className="w-full py-2 px-4 rounded-xl border" />

            <h1 className="font-bold py-2">??????</h1>
            <select className="w-full py-2 px-2 rounded-xl border">
              <option aria-disabled>Choose</option>
              <option>Deviation, missed trip; Customer not at home</option>
              <option>Deviation, dead end; Customer cancelled</option>
              <option>Deviation, missed delivery; Damaged goods</option>
              <option>Deviation, delivery toll stairs; Wrong item</option>
              <option>Deviation, toll; Wrong address</option>
              <option>Deviation, toll trip; New driving date</option>
              <option>Deviation, missed trip; Warehouse cannot find the product</option>
              <option>Deviation, toll trip; Cancelled the day before</option>
            </select>

            <div className="pt-2">
              <input type="checkbox" className="inline" />
              <p className="inline pl-2">Fee for extra work per started</p>
            </div>
            <div className="pt-2">
              <input type="checkbox" className="inline" />
              <p className="inline pl-2">Fee for adding to order</p>
            </div>

            <h1 className="font-bold py-2">Status notes</h1>
            <input className="w-full py-2 px-4 h-30 rounded-xl border" />

            <h1 className="font-bold py-2">Change customer</h1>
            <select className="w-full py-2 px-2 rounded-xl border">
              <option aria-disabled>Choose</option>
              <option>Power this</option>
              <option>Power that</option>
            </select>

            <h1 className="font-bold py-2">Status</h1>
            <select className="w-full py-2 px-2 rounded-xl border">
              <option aria-disabled>Choose</option>
              <option></option>
              <option>Behandles</option>
              <option>Bekreftet</option>
              <option>Aktiv</option>
              <option>Kanselert</option>
              <option>Fail</option>
              <option>Ferdig</option>
              <option>Fakturert</option>
              <option>Betalt</option>
            </select>

            <h1 className="font-bold py-2">Attachment</h1>

            <input type="checkbox" className=" inline mr-2" />
            <p className="py-2 inline">Don&apos;t send email</p>

            <button
              className="block w-full mb-20 mt-8 border-2 border-logoblue text-logoblue py-4 px-8 rounded-2xl cursor-pointer font-bold hover:bg-logoblue hover:text-white"
              type="submit"
            >
              Submit
            </button>
          </div>
        </div>

        {/* Price Calculator - Fixed position on right side */}
        <div className="fixed left-230 top-32">
          <CalculatorDisplay total={total} productBreakdowns={productBreakdowns} />
        </div>
      </main>
    </>
  );
}
