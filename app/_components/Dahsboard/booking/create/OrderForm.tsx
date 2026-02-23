"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/app/_components/Dahsboard/booking/create/ProductCard";
import { PickupLocations } from "@/app/_components/Dahsboard/booking/create/PickupLocations";
import { CalculatorDisplay } from "@/app/_components/Dahsboard/booking/create/CalculatorDisplay";
import { PRICE_ITEMS_DEFAULT } from "@/lib/prices_default/pricingDefault";
import { PRODUCTS_DEFAULT } from "@/lib/prices_default/productsDefault";
import type { DeliveryType, LineItem } from "@/app/_components/Dahsboard/booking/create/ProductCard";

/*Bitmap*/
export const OrderFields = {
  // sections
  Products:            1 << 0,
  AddProductButton:    1 << 1,
  PickupLocations:     1 << 2,
  Calculator:          1 << 3,

  // order details
  OrderNumber:         1 << 4,
  Description:         1 << 5,
  ModelNr:             1 << 6,
  DeliveryDate:        1 << 7,
  DeliveryTimeWindow:  1 << 8,
  DeliveryAddress:     1 << 9,
  DrivingDistance:     1 << 10,

  // customer
  CustomerName:        1 << 11,
  CustomerPhone1:      1 << 12,
  CustomerPhone2:      1 << 13,
  CustomerEmail:       1 << 14,
  CustomerComments:    1 << 15,

  // delivery details
  FloorNo:             1 << 16,
  Lift:                1 << 17,

  // cashier
  CashierName:         1 << 18,
  CashierPhone:        1 << 19,

  // ops
  Subcontractor:       1 << 20,
  Driver1:             1 << 21,
  Driver2:             1 << 22,
  DriverInfo:          1 << 23,
  LicensePlate:        1 << 24,

  // misc
  Deviation:           1 << 25,
  FeeExtraWork:        1 << 26,
  FeeAddToOrder:       1 << 27,
  StatusNotes:         1 << 28,
  ChangeCustomer:      1 << 29,
  Status:              1 << 30,
  Attachment:          1 << 31,
} as const;

export type HiddenMask = number;

function shown(hiddenMask: HiddenMask, flag: number) {
  return (hiddenMask & flag) === 0;
}

/* this is for filtering the form, add a category and the fields it hides, default is the full view.*/

export const OrderPresets = {
  CashierView:
    OrderFields.Driver1       |
    OrderFields.Driver2       |
    OrderFields.DriverInfo    |
    OrderFields.LicensePlate  |
    OrderFields.Subcontractor |
    OrderFields.Deviation,

  DriverView:
    OrderFields.CashierName    |
    OrderFields.CashierPhone   |
    OrderFields.ChangeCustomer |
    OrderFields.FeeExtraWork   |
    OrderFields.FeeAddToOrder,

    Power:
    OrderFields.OrderNumber        |
    OrderFields.DrivingDistance    |
    OrderFields.CustomerPhone2     |
    OrderFields.CustomerComments   |
    OrderFields.FloorNo            |
    OrderFields.Lift               |
    OrderFields.CashierName        |
    OrderFields.CashierPhone       |
    OrderFields.Subcontractor      |
    OrderFields.Driver1            |
    OrderFields.Driver2            |
    OrderFields.DriverInfo         |
    OrderFields.LicensePlate       |
    OrderFields.Deviation          |
    OrderFields.FeeExtraWork       |
    OrderFields.FeeAddToOrder      |
    OrderFields.StatusNotes        |
    OrderFields.ChangeCustomer     |
    OrderFields.Status             |
    OrderFields.Attachment,
} as const;

// ============================================================================
// PRICING HELPERS
// ============================================================================

function codeToKey(code: string): string | null {
  return PRICE_ITEMS_DEFAULT.find((i) => i.code === code)?.key ?? null;
}

// Order-level fees — charged once per order regardless of card count
const ORDER_LEVEL_KEYS = new Set<string>(
  ["DELIVERY", "INDOOR", "MONTERING"]
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

    for (const it of items) {
      const price =
        PRICE_ITEMS_DEFAULT.find((p) => p.key === it.key)?.customerPrice ?? 0;

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
// TYPES
// ============================================================================

export type OrderFormPayload = {
  // products
  cards: number[];
  cardItems: Record<number, LineItem[]>;
  cardDeliveryType: Record<number, DeliveryType>;
  cardProducts: Record<number, string | null>;

  // order details
  orderNumber: string;
  description: string;
  modelNr: string;
  deliveryDate: string;
  timeWindow: string;
  deliveryAddress: string;
  drivingDistance: string;

  // customer
  customerName: string;
  phone: string;
  phoneTwo: string;
  email: string;
  customerComments: string;

  // delivery
  floorNo: string;
  lift: "yes" | "no" | "";

  // cashier
  cashierName: string;
  cashierPhone: string;

  // ops
  subcontractor: string;
  driver: string;
  secondDriver: string;
  driverInfo: string;
  licensePlate: string;

  // misc
  deviation: string;
  feeExtraWork: boolean;
  feeAddToOrder: boolean;
  statusNotes: string;
  changeCustomer: string;
  status: string;
  dontSendEmail: boolean;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function OrderForm({
  hidden = 0,
  hideDontSendEmail = false,
  dataset = "default",
  onSubmit,
}: {
  /** Bitmask of OrderFields to hide. 0 = show everything (default). */
  hidden?: HiddenMask;
  /** Separate boolean for DontSendEmail since JS bitmasks are 32-bit. */
  hideDontSendEmail?: boolean;
  dataset?: "default" | "power";
  onSubmit?: (payload: OrderFormPayload) => void;
}) {
  // --- product cards ---
  const [cards, setCards] = useState<number[]>([0]);
  const nextCardId = useRef(1);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });

  const [cardItems, setCardItems] = useState<Record<number, LineItem[]>>({});
  const [cardDeliveryType, setCardDeliveryType] = useState<Record<number, DeliveryType>>({});
  const [cardProducts, setCardProducts] = useState<Record<number, string | null>>({});

  const canRemove = cards.length > 1;

  const addCard = () => {
    const id = nextCardId.current++;
    setCards((prev) => [...prev, id]);
    setExpanded((prev) => {
      const collapsed: Record<number, boolean> = {};
      for (const k of Object.keys(prev)) collapsed[Number(k)] = false;
      for (const c of cards) collapsed[c] = false;
      collapsed[id] = true;
      return collapsed;
    });
  };

  const removeCard = (id: number) => {
    if (!canRemove) return;
    setCards((prev) => prev.filter((c) => c !== id));
    setExpanded((prev) => { const c = { ...prev }; delete c[id]; return c; });
    setCardItems((prev) => { const c = { ...prev }; delete c[id]; return c; });
    setCardDeliveryType((prev) => { const c = { ...prev }; delete c[id]; return c; });
    setCardProducts((prev) => { const c = { ...prev }; delete c[id]; return c; });
  };

  const makeOnProductChange = useCallback(
    (cardId: number) => (productId: string | null) => {
      setCardProducts((prev) => ({ ...prev, [cardId]: productId }));
    },
    []
  );

  // --- pricing ---
  const total = useMemo(
    () => calculateTotalFromCards(cardItems, cardDeliveryType),
    [cardItems, cardDeliveryType]
  );

  const productBreakdowns = useMemo(() => {
    const seenOrderLevel = new Set<string>();

    return cards
      .map((cardId) => {
        const productId = cardProducts[cardId];
        const productName = productId
          ? PRODUCTS_DEFAULT.find((p) => p.id === productId)?.label ?? "Unknown Product"
          : "No product selected";

        const rawItems = cardItems[cardId] ?? [];
        const items = rawItems.filter((it) => {
                if (!ORDER_LEVEL_KEYS.has(it.key)) return true;
                if (seenOrderLevel.has(it.key)) return false;
                seenOrderLevel.add(it.key);
                return true;
              });

        return { productName, items };
      })
      .filter((b) => b.items.length > 0 || b.productName !== "No product selected");
  }, [cards, cardProducts, cardItems, cardDeliveryType]);

  // --- form fields ---
  const [orderNumber, setOrderNumber] = useState("");
  const [description, setDescription] = useState("");
  const [modelNr, setModelNr] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [drivingDistance, setDrivingDistance] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("+47 ");
  const [phoneTwo, setPhoneTwo] = useState("+47 ");
  const [email, setEmail] = useState("");
  const [customerComments, setCustomerComments] = useState("");

  const [floorNo, setFloorNo] = useState("");
  const [lift, setLift] = useState<"yes" | "no" | "">("");

  const [cashierName, setCashierName] = useState("");
  const [cashierPhone, setCashierPhone] = useState("+47 ");

  const [subcontractor, setSubcontractor] = useState("");
  const [driver, setDriver] = useState("");
  const [secondDriver, setSecondDriver] = useState("");
  const [driverInfo, setDriverInfo] = useState("");
  const [licensePlate, setLicensePlate] = useState("");

  const [deviation, setDeviation] = useState("");
  const [feeExtraWork, setFeeExtraWork] = useState(false);
  const [feeAddToOrder, setFeeAddToOrder] = useState(false);

  const [statusNotes, setStatusNotes] = useState("");
  const [changeCustomer, setChangeCustomer] = useState("");
  const [status, setStatus] = useState("");

  const [dontSendEmail, setDontSendEmail] = useState(false);

  // --- submit ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({
      cards, cardItems, cardDeliveryType, cardProducts,
      orderNumber, description, modelNr, deliveryDate, timeWindow,
      deliveryAddress, drivingDistance,
      customerName, phone, phoneTwo, email, customerComments,
      floorNo, lift,
      cashierName, cashierPhone,
      subcontractor, driver, secondDriver, driverInfo, licensePlate,
      deviation, feeExtraWork, feeAddToOrder,
      statusNotes, changeCustomer, status, dontSendEmail,
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <form onSubmit={handleSubmit}>
      <main className="flex justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex w-full max-w-300 gap-5">
          <div className="flex-1 min-w-75">

            {/* Product Cards */}
            {shown(hidden, OrderFields.Products) &&
              cards.map((id, index) => (
                <ProductCard
                  dataset={dataset}
                  key={id}
                  cardId={id}
                  displayIndex={index + 1}
                  onChange={({ items, deliveryType }) => {
                    setCardItems((prev) => ({ ...prev, [id]: items }));
                    setCardDeliveryType((prev) => ({ ...prev, [id]: deliveryType }));
                  }}
                  onProductChange={makeOnProductChange(id)}
                  onRemove={removeCard}
                  disableRemove={!canRemove}
                  isExpanded={expanded[id] ?? true}
                  onToggle={() =>
                    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))
                  }
                />
              ))}

            {shown(hidden, OrderFields.AddProductButton) && (
              <button
                type="button"
                className="my-8 w-full font-bold cursor-pointer border-2 border-logoblue text-logoblue py-3 px-4 rounded-xl hover:bg-logoblue hover:text-white"
                onClick={addCard}
              >
                Add extra products
              </button>
            )}

            <div>
              {shown(hidden, OrderFields.OrderNumber) && (
                <>
                  <h1 className="font-bold py-2">Order number</h1>
                  <input
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Description) && (
                <>
                  <h1 className="font-bold py-2">Description</h1>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full py-2 px-4 h-30 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.ModelNr) && (
                <>
                  <h1 className="font-bold py-2">Model number</h1>
                  <input
                    value={modelNr}
                    onChange={(e) => setModelNr(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.DeliveryDate) && (
                <>
                  <h1 className="font-bold py-2">Delivery date</h1>
                  <input
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.DeliveryTimeWindow) && (
                <>
                  <h1 className="font-bold py-2">Delivery Time window</h1>
                  <select
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                    className="w-full py-2 px-2 rounded-xl border"
                  >
                    <option value="">Choose</option>
                    <option value="10:00-16:00">10:00-16:00</option>
                    <option value="16:00-21:00">16:00-21:00</option>
                    <option value="contact">Contact client</option>
                  </select>
                </>
              )}

              {shown(hidden, OrderFields.PickupLocations) && <PickupLocations />}

              {shown(hidden, OrderFields.DeliveryAddress) && (
                <>
                  <h1 className="font-bold py-2">Delivery address</h1>
                  <input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                    placeholder="Enter a location"
                  />
                </>
              )}

              {shown(hidden, OrderFields.DrivingDistance) && (
                <>
                  <h1 className="font-bold py-2">Total driving distance</h1>
                  <input
                    value={drivingDistance}
                    onChange={(e) => setDrivingDistance(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerName) && (
                <>
                  <h1 className="font-bold py-2">Customer&apos;s name</h1>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerPhone1) && (
                <>
                  <h1 className="font-bold py-2">Customer&apos;s phone</h1>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border px-4 py-2 outline-none"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerPhone2) && (
                <>
                  <h1 className="font-bold py-2">Additional customer&apos;s phone</h1>
                  <input
                    type="tel"
                    value={phoneTwo}
                    onChange={(e) => setPhoneTwo(e.target.value)}
                    className="w-full rounded-xl border px-4 py-2 outline-none"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerEmail) && (
                <>
                  <h1 className="font-bold py-2">Customer&apos;s email</h1>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerComments) && (
                <>
                  <h1 className="font-bold py-2">Customer comments</h1>
                  <input
                    value={customerComments}
                    onChange={(e) => setCustomerComments(e.target.value)}
                    className="w-full py-2 px-4 h-30 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.FloorNo) && (
                <>
                  <h1 className="font-bold py-2">Floor No.</h1>
                  <input
                    value={floorNo}
                    onChange={(e) => setFloorNo(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Lift) && (
                <>
                  <h1 className="font-bold py-2">Lift</h1>
                  <label className="mr-4 inline-flex items-center gap-2">
                    <input
                      className="inline"
                      type="radio"
                      name="lift"
                      checked={lift === "yes"}
                      onChange={() => setLift("yes")}
                    />
                    <span>Yes</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      className="inline"
                      type="radio"
                      name="lift"
                      checked={lift === "no"}
                      onChange={() => setLift("no")}
                    />
                    <span>No</span>
                  </label>
                </>
              )}

              {shown(hidden, OrderFields.CashierName) && (
                <>
                  <h1 className="font-bold py-2">Cashier&apos;s name</h1>
                  <input
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CashierPhone) && (
                <>
                  <h1 className="font-bold py-2">Cashier&apos;s phone</h1>
                  <input
                    type="tel"
                    value={cashierPhone}
                    onChange={(e) => setCashierPhone(e.target.value)}
                    className="w-full rounded-xl border px-4 py-2 outline-none"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Subcontractor) && (
                <>
                  <h1 className="font-bold py-2">Subcontractor</h1>
                  <select
                    value={subcontractor}
                    onChange={(e) => setSubcontractor(e.target.value)}
                    className="w-full py-2 px-2 rounded-xl border"
                  >
                    <option value="">Choose</option>
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
                </>
              )}

              {shown(hidden, OrderFields.Driver1) && (
                <>
                  <h1 className="font-bold py-2">Driver</h1>
                  <input
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Driver2) && (
                <>
                  <h1 className="font-bold py-2">Second driver</h1>
                  <input
                    value={secondDriver}
                    onChange={(e) => setSecondDriver(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.DriverInfo) && (
                <>
                  <h1 className="font-bold py-2">Info for the driver</h1>
                  <input
                    value={driverInfo}
                    onChange={(e) => setDriverInfo(e.target.value)}
                    className="w-full py-2 px-4 h-30 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.LicensePlate) && (
                <>
                  <h1 className="font-bold py-2">License plate</h1>
                  <input
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="w-full py-2 px-4 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Deviation) && (
                <>
                  <h1 className="font-bold py-2">Deviation</h1>
                  <select
                    value={deviation}
                    onChange={(e) => setDeviation(e.target.value)}
                    className="w-full py-2 px-2 rounded-xl border"
                  >
                    <option value="">Choose</option>
                    <option>Deviation, missed trip; Customer not at home</option>
                    <option>Deviation, dead end; Customer cancelled</option>
                    <option>Deviation, missed delivery; Damaged goods</option>
                    <option>Deviation, delivery toll stairs; Wrong item</option>
                    <option>Deviation, toll; Wrong address</option>
                    <option>Deviation, toll trip; New driving date</option>
                    <option>Deviation, missed trip; Warehouse cannot find the product</option>
                    <option>Deviation, toll trip; Cancelled the day before</option>
                  </select>
                </>
              )}

              {shown(hidden, OrderFields.FeeExtraWork) && (
                <div className="pt-2">
                  <input
                    type="checkbox"
                    className="inline"
                    checked={feeExtraWork}
                    onChange={(e) => setFeeExtraWork(e.target.checked)}
                  />
                  <p className="inline pl-2">Fee for extra work per started</p>
                </div>
              )}

              {shown(hidden, OrderFields.FeeAddToOrder) && (
                <div className="pt-2">
                  <input
                    type="checkbox"
                    className="inline"
                    checked={feeAddToOrder}
                    onChange={(e) => setFeeAddToOrder(e.target.checked)}
                  />
                  <p className="inline pl-2">Fee for adding to order</p>
                </div>
              )}

              {shown(hidden, OrderFields.StatusNotes) && (
                <>
                  <h1 className="font-bold py-2">Status notes</h1>
                  <input
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    className="w-full py-2 px-4 h-30 rounded-xl border"
                  />
                </>
              )}

              {shown(hidden, OrderFields.ChangeCustomer) && (
                <>
                  <h1 className="font-bold py-2">Change customer</h1>
                  <select
                    value={changeCustomer}
                    onChange={(e) => setChangeCustomer(e.target.value)}
                    className="w-full py-2 px-2 rounded-xl border"
                  >
                    <option value="">Choose</option>
                    <option>Power this</option>
                    <option>Power that</option>
                  </select>
                </>
              )}

              {shown(hidden, OrderFields.Status) && (
                <>
                  <h1 className="font-bold py-2">Status</h1>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full py-2 px-2 rounded-xl border"
                  >
                    <option value="">Choose</option>
                    <option>Behandles</option>
                    <option>Bekreftet</option>
                    <option>Aktiv</option>
                    <option>Kanselert</option>
                    <option>Fail</option>
                    <option>Ferdig</option>
                    <option>Fakturert</option>
                    <option>Betalt</option>
                  </select>
                </>
              )}

              {shown(hidden, OrderFields.Attachment) && (
                <>
                  <h1 className="font-bold py-2">Attachment</h1>
                  {/* plug in your file input later */}
                </>
              )}

              {!hideDontSendEmail && (
                <label className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    checked={dontSendEmail}
                    onChange={(e) => setDontSendEmail(e.target.checked)}
                  />
                  <span>Don&apos;t send email</span>
                </label>
              )}

              <button
                className="block w-full mb-20 mt-8 border-2 border-logoblue text-logoblue py-4 px-8 rounded-2xl cursor-pointer font-bold hover:bg-logoblue hover:text-white"
                type="submit"
              >
                Submit
              </button>
            </div>
          </div>

          {shown(hidden, OrderFields.Calculator) && (
            <div className="flex-1 min-w-75">
              <CalculatorDisplay total={total} productBreakdowns={productBreakdowns} />
            </div>
          )}
        </div>
      </main>
    </form>
  );
}