"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/app/_components/Dahsboard/booking/create/ProductCard";
import { PickupLocations } from "@/app/_components/Dahsboard/booking/create/PickupLocations";
import { CalculatorDisplay } from "@/app/_components/Dahsboard/booking/create/CalculatorDisplay";
import { PRICE_ITEMS_DEFAULT } from "@/lib/prices_default/pricingDefault";
import { PRICE_ITEMS_POWER} from "@/lib/prices_power/pricingPower";
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
/*This is to seed from clicked row in booking archive */
export type OrderFormInitialValues = Partial<Omit<OrderFormPayload, "cards" | "cardItems" | "cardDeliveryType" | "cardProducts">>;

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
  return (
    PRICE_ITEMS_DEFAULT.find((i) => i.code === code)?.key ??
    PRICE_ITEMS_POWER.find((i) => i.code === code)?.key ??
    null
  );
}

const DELIVERY_BASE_KEYS = new Set<string>(
  ["DELIVERY", "INDOOR", "MONTERING"]
    .map(codeToKey)
    .filter((x): x is string => Boolean(x))
);

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
  initialValues = {},
  hideSubmitButton = false,
}: {
  /** Bitmask of OrderFields to hide. 0 = show everything (default). */
  hidden?: HiddenMask;
  /** Separate boolean for DontSendEmail since JS bitmasks are 32-bit. */
  hideDontSendEmail?: boolean;
  dataset?: "default" | "power";
  onSubmit?: (payload: OrderFormPayload) => void;
  initialValues?: OrderFormInitialValues;
  hideSubmitButton?: boolean;
}) {
  // --- product cards ---
  const [calcOpen, setCalcOpen] = useState(false);
  const [cards, setCards] = useState<number[]>([0]);
  const nextCardId = useRef(1);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
  const [cardAmounts, setCardAmounts] = useState<Record<number, number>>({});
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


  const productBreakdowns = useMemo(() => {
  const xtraKey = codeToKey("XTRA");

  // Pre-pass: find the first card with a delivery based type selected
  const deliveryTypes = ["Første trinn", "Innbæring", "Kun Installasjon/Montering"];
  const firstDeliveryCardId =
    cards.find((cardId) => deliveryTypes.includes(cardDeliveryType[cardId] ?? "")) ?? null;

  return cards
    .map((cardId) => {
      const productId = cardProducts[cardId];
      const productName = productId
        ? PRODUCTS_DEFAULT.find((p) => p.id === productId)?.label ?? "Unknown Product"
        : "No product selected";

      const rawItems = cardItems[cardId] ?? [];
      const needsDeliveryBase = deliveryTypes.includes(cardDeliveryType[cardId] ?? "");

      let items = [...rawItems];

      if (needsDeliveryBase && cardId !== firstDeliveryCardId) {
        const existingXtra = rawItems.find((it) => it.key === xtraKey);
        const inferredAmt = existingXtra ? existingXtra.qty + 1 : cardAmounts[cardId] ?? 1;

        items = items.filter((it) => !DELIVERY_BASE_KEYS.has(it.key) && it.key !== xtraKey);
        if (xtraKey) items = [{ key: xtraKey, qty: inferredAmt }, ...items];
      }

      return { productName, items };
    }).filter((b) => b.items.length > 0 || b.productName !== "No product selected");
}, [cards, cardProducts, cardItems, cardAmounts, cardDeliveryType]);

  // --- pricing ---
const total = useMemo(() => {
  return productBreakdowns.reduce((sum, product) => {
    return sum + product.items.reduce((s, it) => {
      const price = it.priceOverride !== undefined
        ? it.priceOverride
        : PRICE_ITEMS_DEFAULT.find((p) => p.key === it.key)?.customerPrice ?? 0;
      return s + price * it.qty;
    }, 0);
  }, 0);
}, [productBreakdowns]);

  // --- form fields ---

const [orderNumber, setOrderNumber]   = useState(initialValues.orderNumber   ?? "");
const [description, setDescription]   = useState(initialValues.description   ?? "");
const [modelNr, setModelNr]           = useState(initialValues.modelNr       ?? "");
const [deliveryDate, setDeliveryDate] = useState(initialValues.deliveryDate  ?? "");
const [timeWindow, setTimeWindow]     = useState(initialValues.timeWindow    ?? "");
const [deliveryAddress, setDeliveryAddress] = useState(initialValues.deliveryAddress ?? "");
const [drivingDistance, setDrivingDistance] = useState(initialValues.drivingDistance ?? "");

const [customerName, setCustomerName] = useState(initialValues.customerName ?? "");
const [phone, setPhone]               = useState(initialValues.phone        ?? "+47 ");
const [phoneTwo, setPhoneTwo]         = useState(initialValues.phoneTwo     ?? "+47 ");
const [email, setEmail]               = useState(initialValues.email        ?? "");
const [customerComments, setCustomerComments] = useState(initialValues.customerComments ?? "");

const [floorNo, setFloorNo]           = useState(initialValues.floorNo ?? "");
const [lift, setLift]                 = useState<"yes" | "no" | "">(initialValues.lift ?? "");

const [cashierName, setCashierName]   = useState(initialValues.cashierName  ?? "");
const [cashierPhone, setCashierPhone] = useState(initialValues.cashierPhone ?? "+47 ");

const [subcontractor, setSubcontractor] = useState(initialValues.subcontractor ?? "");
const [driver, setDriver]               = useState(initialValues.driver         ?? "");
const [secondDriver, setSecondDriver]   = useState(initialValues.secondDriver   ?? "");
const [driverInfo, setDriverInfo]       = useState(initialValues.driverInfo     ?? "");
const [licensePlate, setLicensePlate]   = useState(initialValues.licensePlate   ?? "");

const [deviation, setDeviation]         = useState(initialValues.deviation      ?? "");
const [feeExtraWork, setFeeExtraWork]   = useState(initialValues.feeExtraWork   ?? false);
const [feeAddToOrder, setFeeAddToOrder] = useState(initialValues.feeAddToOrder  ?? false);
const [statusNotes, setStatusNotes]     = useState(initialValues.statusNotes    ?? "");
const [changeCustomer, setChangeCustomer] = useState(initialValues.changeCustomer ?? "");
const [status, setStatus]               = useState(initialValues.status         ?? "");
const [dontSendEmail, setDontSendEmail] = useState(initialValues.dontSendEmail  ?? false);

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
      <main className="flex justify-center ">
        <div className="flex w-full max-w-300 gap-5 ">
          <div className="md:flex-1 min-w-75 mr-[40] w-full lg:mr-0 ">

            {/* Product Cards */}
            {shown(hidden, OrderFields.Products) &&
              cards.map((id, index) => (
                <ProductCard
                  dataset={dataset}
                  key={id}
                  cardId={id}
                  displayIndex={index + 1}
                  onChange={({ items, deliveryType, amount }) => {
                    setCardItems((prev) => ({ ...prev, [id]: items }));
                    setCardDeliveryType((prev) => ({ ...prev, [id]: deliveryType }));
                    setCardAmounts((prev) => ({ ...prev, [id]: amount }));
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
            <>
              {/* Mobile: collapsed vertical rail -> expands */}
              <div className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40">
                {!calcOpen ? (
                  <button
                    type="button"
                    onClick={() => setCalcOpen(true)}
                    className="h-80 w-10 rounded-l-full bg-white shadow-xl border border-black/10 flex items-center justify-center"
                    aria-label="Open calculator"
                  >
                    <span className="[writing-mode:vertical-rl] rotate-180 text-md font-semibold text-logoblue">
                      Calculator
                    </span>
                  </button>
                ) : (
                  <div className="flex flex-col bg-white overflow-auto border rounded-2xl shadow-xl">
                    <button
                      type="button"
                      onClick={() => setCalcOpen(false)}
                      className="rounded-4xl bg-logoblue text-sm font-semibold w-[80] h-[40] text-white text-center ml-auto mr-2 mt-2"
                      aria-label="Close calculator"
                    >
                      Close
                    </button>

                    <div className="p-4">
                      <CalculatorDisplay total={total} productBreakdowns={productBreakdowns} adminView={dataset === "default"} />
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: normal flow */}
              <div className="hidden lg:block flex-1 min-w-75">
                <CalculatorDisplay total={total} productBreakdowns={productBreakdowns} adminView={dataset === "default"} />
              </div>
            </>
          )}
          {!hideSubmitButton && (
            <button
              className="block w-full mb-20 mt-8 border-2 ..."
              type="submit"
            >
              Submit
            </button>
          )}
        </div>
      </main>
    </form>
  );
}