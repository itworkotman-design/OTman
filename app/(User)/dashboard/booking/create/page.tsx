"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  SavedProductCard,
  createEmptyProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { ProductCardNew } from "@/app/_components/Dahsboard/booking/create/ProductCardNew";
import { PickupLocations } from "@/app/_components/Dahsboard/booking/create/PickupLocations";
import { CalculatorDisplayNew } from "@/app/_components/Dahsboard/booking/create/CalculatorDisplayNew";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import {
  OrderFields,
  shown,
  type HiddenMask,
} from "@/app/_components/Dahsboard/booking/create/orderFields";
import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";

export type OrderFormPayload = {
  productCards: SavedProductCard[];

  orderNumber: string;
  description: string;
  modelNr: string;
  deliveryDate: string;
  timeWindow: string;
  deliveryAddress: string;
  drivingDistance: string;

  customerName: string;
  phone: string;
  phoneTwo: string;
  email: string;
  customerComments: string;

  floorNo: string;
  lift: "yes" | "no" | "";

  cashierName: string;
  cashierPhone: string;

  subcontractor: string;
  driver: string;
  secondDriver: string;
  driverInfo: string;
  licensePlate: string;

  deviation: string;
  feeExtraWork: boolean;
  feeAddToOrder: boolean;
  statusNotes: string;
  changeCustomer: string;
  status: string;
  dontSendEmail: boolean;

  priceExVat: number;
  priceSubcontractor: number;

  rabatt: string;
  leggTil: string;
  subcontractorMinus: string;
  subcontractorPlus: string;
};

type Props = {
  hidden?: HiddenMask;
  hideDontSendEmail?: boolean;
  dataset?: "default" | "power";
  hideSubmitButton?: boolean;
  onSubmit?: (payload: OrderFormPayload) => void;
};

export default function CreatePage({
  hidden = 0,
  hideDontSendEmail = false,
  dataset = "default",
  hideSubmitButton = false,
  onSubmit,
}: Props) {
  const [calcOpen, setCalcOpen] = useState(false);

  const [productCards, setProductCards] = useState<SavedProductCard[]>([
    createEmptyProductCard(0),
  ]);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(0);

  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [priceExVat, setPriceExVat] = useState(0);
  const [priceSubcontractor, setPriceSubcontractor] = useState(0);

  const [rabatt, setRabatt] = useState("");
  const [leggTil, setLeggTil] = useState("");
  const [subcontractorMinus, setSubcontractorMinus] = useState("");
  const [subcontractorPlus, setSubcontractorPlus] = useState("");

  const [orderNumber, setOrderNumber] = useState("");
  const [description, setDescription] = useState("");
  const [modelNr, setModelNr] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [drivingDistance, setDrivingDistance] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTwo, setPhoneTwo] = useState("");
  const [email, setEmail] = useState("");
  const [customerComments, setCustomerComments] = useState("");

  const [floorNo, setFloorNo] = useState("");
  const [lift, setLift] = useState<"yes" | "no" | "">("");

  const [cashierName, setCashierName] = useState("");
  const [cashierPhone, setCashierPhone] = useState("");

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

  useEffect(() => {
    async function loadCatalog() {
      try {
        setCatalogLoading(true);
        setCatalogError(null);

        const res = await fetch("/api/booking/catalog", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setCatalogError(data.reason ?? "Failed to load catalog");
          setCatalogProducts([]);
          return;
        }

        setCatalogProducts(data.products ?? []);
      } catch {
        setCatalogError("Failed to load catalog");
        setCatalogProducts([]);
      } finally {
        setCatalogLoading(false);
      }
    }

    loadCatalog();
  }, []);

  const updateProductCard = useCallback(
    (cardId: number, nextValue: SavedProductCard) => {
      setProductCards((current) =>
        current.map((card) => (card.cardId === cardId ? nextValue : card)),
      );
    },
    [],
  );

  const addProductCard = useCallback(() => {
    setProductCards((current) => {
      const nextCardId =
        current.length > 0 ? Math.max(...current.map((c) => c.cardId)) + 1 : 0;

      setExpandedCardId(nextCardId);
      return [...current, createEmptyProductCard(nextCardId)];
    });
  }, []);

  const removeProductCard = useCallback((cardId: number) => {
    setProductCards((current) =>
      current.filter((card) => card.cardId !== cardId),
    );

    setExpandedCardId((current) => (current === cardId ? null : current));
  }, []);

  const productBreakdowns = useMemo(
    () => buildProductBreakdowns(productCards, catalogProducts),
    [productCards, catalogProducts],
  );

  const priceLookup = useMemo(
    () => buildPriceLookup(catalogProducts),
    [catalogProducts],
  );

  const isInstallationOnly = useMemo(
    () =>
      productCards.length > 0 &&
      productCards.every((card) => card.deliveryType === DELIVERY_TYPES.INSTALL_ONLY),
    [productCards],
  );

  const handlePriceChange = useCallback((exVat: number, subPrice: number) => {
    setPriceExVat(exVat);
    setPriceSubcontractor(subPrice);
  }, []);

  const handleAdjustmentsChange = useCallback(
    (adj: {
      rabatt: string;
      leggTil: string;
      subcontractorMinus: string;
      subcontractorPlus: string;
    }) => {
      setRabatt(adj.rabatt);
      setLeggTil(adj.leggTil);
      setSubcontractorMinus(adj.subcontractorMinus);
      setSubcontractorPlus(adj.subcontractorPlus);
    },
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit?.({
      productCards,

      orderNumber,
      description,
      modelNr,
      deliveryDate,
      timeWindow,
      deliveryAddress,
      drivingDistance,

      customerName,
      phone,
      phoneTwo,
      email,
      customerComments,

      floorNo,
      lift,

      cashierName,
      cashierPhone,

      subcontractor,
      driver,
      secondDriver,
      driverInfo,
      licensePlate,

      deviation,
      feeExtraWork,
      feeAddToOrder,
      statusNotes,
      changeCustomer,
      status,
      dontSendEmail,

      priceExVat,
      priceSubcontractor,

      rabatt,
      leggTil,
      subcontractorMinus,
      subcontractorPlus,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <main className="flex justify-center mb-20">
        <div className="flex w-full max-w-300 gap-5">
          <div className="md:flex-1 mr-[40] w-full lg:mr-0">
            {shown(hidden, OrderFields.Products) &&
              productCards.map((card, index) => (
                <ProductCardNew
                  key={card.cardId}
                  cardId={card.cardId}
                  displayIndex={index + 1}
                  value={card}
                  catalogProducts={catalogProducts}
                  loading={catalogLoading}
                  error={catalogError}
                  onChange={(next) => updateProductCard(card.cardId, next)}
                  onRemove={removeProductCard}
                  disableRemove={productCards.length === 1}
                  isExpanded={expandedCardId === card.cardId}
                  onToggle={() =>
                    setExpandedCardId((current) =>
                      current === card.cardId ? null : card.cardId,
                    )
                  }
                />
              ))}

            {shown(hidden, OrderFields.AddProductButton) && (
              <button
                type="button"
                className="customButtonEnabled h-12 my-8 w-full"
                onClick={addProductCard}
              >
                Add extra products
              </button>
            )}

            <div className="customContainer">
              {shown(hidden, OrderFields.OrderNumber) && (
                <>
                  <h1 className="font-bold py-2">Order number</h1>
                  <input
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Description) && (
                <>
                  <h1 className="font-bold py-2">Description</h1>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="customInput w-full h-30"
                  />
                </>
              )}

              {shown(hidden, OrderFields.ModelNr) && (
                <>
                  <h1 className="font-bold py-2">Model number</h1>
                  <input
                    value={modelNr}
                    onChange={(e) => setModelNr(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.DeliveryDate) && (
                <>
                  <h1 className="font-bold py-2">Delivery date</h1>
                  <input
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.DeliveryTimeWindow) && (
                <>
                  <h1 className="font-bold py-2">Delivery Time window</h1>
                  <select
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                    className="customInput w-full"
                  >
                    <option value="">Choose</option>
                    <option value="10:00-16:00">10:00-16:00</option>
                    <option value="16:00-21:00">16:00-21:00</option>
                    <option value="contact">Contact client</option>
                  </select>
                </>
              )}

              {shown(hidden, OrderFields.PickupLocations) && (
                <PickupLocations
                  disabled={isInstallationOnly}
                  overrideValue={
                    isInstallationOnly ? "Product already at client" : undefined
                  }
                  defaultValue="Henteadresse"
                />
              )}

              {shown(hidden, OrderFields.DeliveryAddress) && (
                <>
                  <h1 className="font-bold py-2">Delivery address</h1>
                  <input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="customInput w-full"
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
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerName) && (
                <>
                  <h1 className="font-bold py-2">Customer&apos;s name</h1>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="customInput w-full"
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
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerPhone2) && (
                <>
                  <h1 className="font-bold py-2">
                    Additional customer&apos;s phone
                  </h1>
                  <input
                    type="tel"
                    value={phoneTwo}
                    onChange={(e) => setPhoneTwo(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerEmail) && (
                <>
                  <h1 className="font-bold py-2">Customer&apos;s email</h1>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.CustomerComments) && (
                <>
                  <h1 className="font-bold py-2">Customer comments</h1>
                  <input
                    value={customerComments}
                    onChange={(e) => setCustomerComments(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.FloorNo) && (
                <>
                  <h1 className="font-bold py-2">Floor No.</h1>
                  <input
                    value={floorNo}
                    onChange={(e) => setFloorNo(e.target.value)}
                    className="customInput w-full"
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
                    className="customInput w-full"
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
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Subcontractor) && (
                <>
                  <h1 className="font-bold py-2">Subcontractor</h1>
                  <select
                    value={subcontractor}
                    onChange={(e) => setSubcontractor(e.target.value)}
                    className="customInput w-full"
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
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Driver2) && (
                <>
                  <h1 className="font-bold py-2">Second driver</h1>
                  <input
                    value={secondDriver}
                    onChange={(e) => setSecondDriver(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.DriverInfo) && (
                <>
                  <h1 className="font-bold py-2">Info for the driver</h1>
                  <input
                    value={driverInfo}
                    onChange={(e) => setDriverInfo(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.LicensePlate) && (
                <>
                  <h1 className="font-bold py-2">License plate</h1>
                  <input
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="customInput w-full"
                  />
                </>
              )}

              {shown(hidden, OrderFields.Deviation) && (
                <>
                  <h1 className="font-bold py-2">Deviation</h1>
                  <select
                    value={deviation}
                    onChange={(e) => setDeviation(e.target.value)}
                    className="customInput w-full"
                  >
                    <option value="">Choose</option>
                    <option>
                      Deviation, missed trip; Customer not at home
                    </option>
                    <option>Deviation, dead end; Customer cancelled</option>
                    <option>Deviation, missed delivery; Damaged goods</option>
                    <option>Deviation, delivery toll stairs; Wrong item</option>
                    <option>Deviation, toll; Wrong address</option>
                    <option>Deviation, toll trip; New driving date</option>
                    <option>
                      Deviation, missed trip; Warehouse cannot find the product
                    </option>
                    <option>
                      Deviation, toll trip; Cancelled the day before
                    </option>
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
                    className="customInput w-full h-30"
                  />
                </>
              )}

              {shown(hidden, OrderFields.ChangeCustomer) && (
                <>
                  <h1 className="font-bold py-2">Change customer</h1>
                  <select
                    value={changeCustomer}
                    onChange={(e) => setChangeCustomer(e.target.value)}
                    className="customInput w-full"
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
                    className="customInput w-full"
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

              {!hideSubmitButton && (
                <button
                  className="w-full customButtonEnabled h-12 mt-8"
                  type="submit"
                >
                  Submit
                </button>
              )}
            </div>
          </div>

          {shown(hidden, OrderFields.Calculator) && (
            <>
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
                      <CalculatorDisplayNew
                        productBreakdowns={productBreakdowns}
                        priceLookup={priceLookup}
                        adminView={dataset === "default"}
                        onPriceChange={handlePriceChange}
                        onAdjustmentsChange={handleAdjustmentsChange}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:block flex-1">
                <CalculatorDisplayNew
                  productBreakdowns={productBreakdowns}
                  priceLookup={priceLookup}
                  adminView={dataset === "default"}
                  onPriceChange={handlePriceChange}
                  onAdjustmentsChange={handleAdjustmentsChange}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </form>
  );
}
