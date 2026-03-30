"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import OrderFieldsForm from "@/app/_components/Dahsboard/booking/create/OrderFieldsForm";
import { loadUserOptions } from "@/lib/users/loadUserOptions";
import { getCreateOrderViewConfig } from "@/lib/booking/createOrderView";
import {
  SavedProductCard,
  createEmptyProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type {
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { ProductCardNew } from "@/app/_components/Dahsboard/booking/create/ProductCardNew";
import BookingCalculatorPanel from "@/app/_components/Dahsboard/booking/create/BookingCalculatorPanel";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import {
  OrderFields,
  shown,
  type HiddenMask,
} from "@/app/_components/Dahsboard/booking/create/orderFields";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import type { AppPermission, UserOption } from "@/lib/users/types";

export type OrderFormPayload = {
  productCards: SavedProductCard[];

  orderNumber: string;
  description: string;
  modelNr: string;
  deliveryDate: string;
  timeWindow: string;

  pickupAddress: string;
  extraPickupAddress: string[];

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

  subcontractorId: string;
  subcontractor: string;
  driver: string;
  secondDriver: string;
  driverInfo: string;
  licensePlate: string;

  deviation: string;
  feeExtraWork: boolean;
  feeAddToOrder: boolean;
  statusNotes: string;
  changeCustomerId: string;
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
  onSubmit?: (payload: OrderFormPayload) => void | Promise<void>;
};

export default function CreatePage({
  hidden = 0,
  hideDontSendEmail = false,
  dataset = "default",
  hideSubmitButton = false,
  onSubmit,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);
  const [productCards, setProductCards] = useState<SavedProductCard[]>([
    createEmptyProductCard(0),
  ]);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(0);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogSpecialOptions, setCatalogSpecialOptions] = useState<
    CatalogSpecialOption[]
  >([]);
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
  const [customTimeFrom, setCustomTimeFrom] = useState("");
  const [customTimeTo, setCustomTimeTo] = useState("");
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
  const [subcontractorId, setSubcontractorId] = useState("");
  const [subcontractorOptions, setSubcontractorOptions] = useState<
    UserOption[]
  >([]);
  const [subcontractorLoading, setSubcontractorLoading] = useState(false);
  const [driver, setDriver] = useState("");
  const [secondDriver, setSecondDriver] = useState("");
  const [driverInfo, setDriverInfo] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [deviation, setDeviation] = useState("");
  const [feeExtraWork, setFeeExtraWork] = useState(false);
  const [feeAddToOrder, setFeeAddToOrder] = useState(false);
  const [statusNotes, setStatusNotes] = useState("");
  const [changeCustomerId, setChangeCustomerId] = useState("");
  const [changeCustomerOptions, setChangeCustomerOptions] = useState<
    UserOption[]
  >([]);
  const [changeCustomerLoading, setChangeCustomerLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [dontSendEmail, setDontSendEmail] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [extraPickups, setExtraPickups] = useState<
    { id: string; value: string }[]
  >([]);

  const currentUser = useCurrentUser();
  const role = currentUser?.role ?? "USER";
  const permissions = (currentUser?.permissions ?? []) as AppPermission[];
  const { effectiveHidden, effectiveHideDontSendEmail } =
    getCreateOrderViewConfig(role, permissions, hidden, hideDontSendEmail);
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
          setCatalogSpecialOptions([]);
          return;
        }

        setCatalogProducts(data.products ?? []);
        setCatalogSpecialOptions(data.specialOptions ?? []);
      } catch {
        setCatalogError("Failed to load catalog");
        setCatalogProducts([]);
        setCatalogSpecialOptions([]);
      } finally {
        setCatalogLoading(false);
      }
    }

    loadCatalog();
  }, []);

  //loading Subcontractors
  useEffect(() => {
    async function run() {
      try {
        setSubcontractorLoading(true);
        const options = await loadUserOptions(
          "/api/auth/subcontractors",
          "subcontractors",
        );
        setSubcontractorOptions(options);
      } finally {
        setSubcontractorLoading(false);
      }
    }

    run();
  }, []);

  //loading Order creators
  useEffect(() => {
    async function run() {
      try {
        setChangeCustomerLoading(true);
        const options = await loadUserOptions(
          "/api/auth/order-creators",
          "orderCreators",
        );
        setChangeCustomerOptions(options);
      } finally {
        setChangeCustomerLoading(false);
      }
    }

    run();
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
    () =>
      buildProductBreakdowns(
        productCards,
        catalogProducts,
        catalogSpecialOptions,
      ),
    [productCards, catalogProducts, catalogSpecialOptions],
  );

  const priceLookup = useMemo(
    () => buildPriceLookup(catalogProducts, catalogSpecialOptions),
    [catalogProducts, catalogSpecialOptions],
  );

  const isInstallationOnly = useMemo(
    () =>
      productCards.length > 0 &&
      productCards.every(
        (card) => card.deliveryType === DELIVERY_TYPES.INSTALL_ONLY,
      ),
    [productCards],
  );

  const isReturnOnly = useMemo(
    () =>
      productCards.length > 0 &&
      productCards.every(
        (card) => card.deliveryType === DELIVERY_TYPES.RETURN_ONLY,
      ),
    [productCards],
  );

  const selectedSubcontractor = useMemo(
    () => subcontractorOptions.find((option) => option.id === subcontractorId),
    [subcontractorId, subcontractorOptions],
  );

  const selectedChangeCustomer = useMemo(
    () =>
      changeCustomerOptions.find((option) => option.id === changeCustomerId),
    [changeCustomerId, changeCustomerOptions],
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

async function handleCreateOrder(payload: OrderFormPayload) {
  setSubmitError("");

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(data?.reason || "Failed to create order");
  }

  console.log("Created order:", data.orderId);
}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (productCards.length === 0) {
      setSubmitError("At least one product is required");
      return;
    }

    if (!customerName.trim()) {
      setSubmitError("Customer name is required");
      return;
    }

    if (!deliveryDate.trim()) {
      setSubmitError("Delivery date is required");
      return;
    }

    if (timeWindow === "custom" && (!customTimeFrom || !customTimeTo)) {
      setSubmitError("Custom time requires both from and to");
      return;
    }

    const finalTimeWindow =
      timeWindow === "custom"
        ? `${customTimeFrom}-${customTimeTo}`
        : timeWindow;

    const payload: OrderFormPayload = {
      productCards,

      orderNumber,
      description,
      modelNr,
      deliveryDate,
      timeWindow: finalTimeWindow,
      pickupAddress,
      extraPickupAddress: extraPickups
        .map((pickup) => pickup.value.trim())
        .filter(Boolean),
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

      subcontractorId,
      subcontractor: selectedSubcontractor?.name ?? "",
      driver,
      secondDriver,
      driverInfo,
      licensePlate,

      deviation,
      feeExtraWork,
      feeAddToOrder,
      statusNotes,
      changeCustomerId,
      changeCustomer: selectedChangeCustomer?.name ?? "",
      status,
      dontSendEmail,

      priceExVat,
      priceSubcontractor,

      rabatt,
      leggTil,
      subcontractorMinus,
      subcontractorPlus,
    };

    try {
      setSaving(true);

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await handleCreateOrder(payload);
      }
    } catch {
      setSubmitError("Failed to save order");
    } finally {
      setSaving(false);
    }
  };
  console.log("STATE CHECK", {
    productCards,
    orderNumber,
    deliveryDate,
    pickupAddress,
    deliveryAddress,
    customerName,
    priceExVat,
  });

  return (
    <form onSubmit={handleSubmit}>
      <main className="flex justify-center mb-20">
        <div className="flex w-full max-w-300 gap-5">
          <div className="md:flex-1 mr-[40] w-full lg:mr-0">
            {shown(effectiveHidden, OrderFields.Products) &&
              productCards.map((card, index) => (
                <ProductCardNew
                  key={card.cardId}
                  cardId={card.cardId}
                  displayIndex={index + 1}
                  value={card}
                  catalogProducts={catalogProducts}
                  catalogSpecialOptions={catalogSpecialOptions}
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

            {shown(effectiveHidden, OrderFields.AddProductButton) && (
              <button
                type="button"
                className="customButtonEnabled h-12 my-8 w-full"
                onClick={addProductCard}
              >
                Add extra products
              </button>
            )}

            <OrderFieldsForm
              hidden={effectiveHidden}
              hideDontSendEmail={effectiveHideDontSendEmail}
              isInstallationOnly={isInstallationOnly}
              isReturnOnly={isReturnOnly}
              hideSubmitButton={hideSubmitButton}
              subcontractorLoading={subcontractorLoading}
              subcontractorOptions={subcontractorOptions}
              changeCustomerLoading={changeCustomerLoading}
              changeCustomerOptions={changeCustomerOptions}
              saving={saving}
              submitError={submitError}
              orderNumber={orderNumber}
              setOrderNumber={setOrderNumber}
              description={description}
              setDescription={setDescription}
              modelNr={modelNr}
              setModelNr={setModelNr}
              deliveryDate={deliveryDate}
              setDeliveryDate={setDeliveryDate}
              timeWindow={timeWindow}
              setTimeWindow={setTimeWindow}
              pickupAddress={pickupAddress}
              setPickupAddress={setPickupAddress}
              extraPickups={extraPickups}
              setExtraPickups={setExtraPickups}
              customTimeFrom={customTimeFrom}
              setCustomTimeFrom={setCustomTimeFrom}
              customTimeTo={customTimeTo}
              setCustomTimeTo={setCustomTimeTo}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              drivingDistance={drivingDistance}
              setDrivingDistance={setDrivingDistance}
              customerName={customerName}
              setCustomerName={setCustomerName}
              phone={phone}
              setPhone={setPhone}
              phoneTwo={phoneTwo}
              setPhoneTwo={setPhoneTwo}
              email={email}
              setEmail={setEmail}
              customerComments={customerComments}
              setCustomerComments={setCustomerComments}
              floorNo={floorNo}
              setFloorNo={setFloorNo}
              lift={lift}
              setLift={setLift}
              cashierName={cashierName}
              setCashierName={setCashierName}
              cashierPhone={cashierPhone}
              setCashierPhone={setCashierPhone}
              subcontractorId={subcontractorId}
              setSubcontractorId={setSubcontractorId}
              driver={driver}
              setDriver={setDriver}
              secondDriver={secondDriver}
              setSecondDriver={setSecondDriver}
              driverInfo={driverInfo}
              setDriverInfo={setDriverInfo}
              licensePlate={licensePlate}
              setLicensePlate={setLicensePlate}
              deviation={deviation}
              setDeviation={setDeviation}
              feeExtraWork={feeExtraWork}
              setFeeExtraWork={setFeeExtraWork}
              feeAddToOrder={feeAddToOrder}
              setFeeAddToOrder={setFeeAddToOrder}
              statusNotes={statusNotes}
              setStatusNotes={setStatusNotes}
              changeCustomerId={changeCustomerId}
              setChangeCustomerId={setChangeCustomerId}
              status={status}
              setStatus={setStatus}
              dontSendEmail={dontSendEmail}
              setDontSendEmail={setDontSendEmail}
            />
          </div>
          <>
            <BookingCalculatorPanel
              calcOpen={calcOpen}
              setCalcOpen={setCalcOpen}
              productBreakdowns={productBreakdowns}
              priceLookup={priceLookup}
              adminView={dataset === "default"}
              onPriceChange={handlePriceChange}
              onAdjustmentsChange={handleAdjustmentsChange}
            />
          </>
        </div>
      </main>
    </form>
  );
}
