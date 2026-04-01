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
  customerMembershipId: string;
  customerLabel: string;
  priceListId?: string;
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
  initialValues?: Partial<OrderFormPayload>;
};

export default function BookingEditor({
  hidden = 0,
  hideDontSendEmail = false,
  dataset = "default",
  hideSubmitButton = false,
  onSubmit,
  initialValues,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);
  const [productCards, setProductCards] = useState<SavedProductCard[]>(
    initialValues?.productCards?.length
      ? initialValues.productCards
      : [createEmptyProductCard(0)],
  );
  const [customerLabel, setCustomerLabel] = useState(
    initialValues?.customerLabel ?? "",
  );
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
  const [orderNumber, setOrderNumber] = useState(
    initialValues?.orderNumber ?? "",
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [modelNr, setModelNr] = useState(initialValues?.modelNr ?? "");
  const [deliveryDate, setDeliveryDate] = useState(
    initialValues?.deliveryDate ?? "",
  );
  const [timeWindow, setTimeWindow] = useState(initialValues?.timeWindow ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(
    initialValues?.deliveryAddress ?? "",
  );
  const [drivingDistance, setDrivingDistance] = useState(
    initialValues?.drivingDistance ?? "",
  );
  const [customerName, setCustomerName] = useState(
    initialValues?.customerName ?? "",
  );
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [phoneTwo, setPhoneTwo] = useState(initialValues?.phoneTwo ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [customerComments, setCustomerComments] = useState(
    initialValues?.customerComments ?? "",
  );
  const [floorNo, setFloorNo] = useState(initialValues?.floorNo ?? "");
  const [lift, setLift] = useState<"yes" | "no" | "">(
    initialValues?.lift ?? "",
  );
  const [cashierName, setCashierName] = useState(
    initialValues?.cashierName ?? "",
  );
  const [cashierPhone, setCashierPhone] = useState(
    initialValues?.cashierPhone ?? "",
  );
  const [subcontractorId, setSubcontractorId] = useState(
    initialValues?.subcontractorId ?? "",
  );
  const [driver, setDriver] = useState(initialValues?.driver ?? "");
  const [secondDriver, setSecondDriver] = useState(
    initialValues?.secondDriver ?? "",
  );
  const [driverInfo, setDriverInfo] = useState(initialValues?.driverInfo ?? "");
  const [licensePlate, setLicensePlate] = useState(
    initialValues?.licensePlate ?? "",
  );
  const [deviation, setDeviation] = useState(initialValues?.deviation ?? "");
  const [feeExtraWork, setFeeExtraWork] = useState(
    initialValues?.feeExtraWork ?? false,
  );
  const [feeAddToOrder, setFeeAddToOrder] = useState(
    initialValues?.feeAddToOrder ?? false,
  );
  const [statusNotes, setStatusNotes] = useState(
    initialValues?.statusNotes ?? "",
  );
  const [customerMembershipId, setCustomerMembershipId] = useState(
    initialValues?.customerMembershipId ?? "",
  );
  const [status, setStatus] = useState(initialValues?.status ?? "behandles");
  const [dontSendEmail, setDontSendEmail] = useState(
    initialValues?.dontSendEmail ?? false,
  );
  const [pickupAddress, setPickupAddress] = useState(
    initialValues?.pickupAddress ?? "",
  );
  const [extraPickups, setExtraPickups] = useState(
    (initialValues?.extraPickupAddress ?? []).map((value, index) => ({
      id: `initial-${index}`,
      value,
    })),
  );
  const [customTimeFrom, setCustomTimeFrom] = useState(
    initialValues?.timeWindow?.includes("-")
      ? (initialValues.timeWindow.split("-")[0] ?? "")
      : "",
  );

  const [customTimeTo, setCustomTimeTo] = useState(
    initialValues?.timeWindow?.includes("-")
      ? (initialValues.timeWindow.split("-")[1] ?? "")
      : "",
  );

  const [subcontractorOptions, setSubcontractorOptions] = useState<
    UserOption[]
  >([]);
  const [subcontractorLoading, setSubcontractorLoading] = useState(false);

  const [changeCustomerOptions, setChangeCustomerOptions] = useState<
    UserOption[]
  >([]);
  const [changeCustomerLoading, setChangeCustomerLoading] = useState(false);

  const currentUser = useCurrentUser();
  const role = currentUser?.role ?? "USER";
  const permissions = (currentUser?.permissions ?? []) as AppPermission[];
  //Attachments
  const [attachments, setAttachments] = useState<
    {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    }[]
  >([]);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState("");
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>(
    [],
  );
  const { effectiveHidden, effectiveHideDontSendEmail } =
    getCreateOrderViewConfig(role, permissions, hidden, hideDontSendEmail);
  useEffect(() => {
    async function loadCatalog() {
      try {
        setCatalogLoading(true);
        setCatalogError(null);

        const catalogUrl = initialValues?.priceListId
          ? `/api/booking/catalog?priceListId=${encodeURIComponent(initialValues.priceListId)}`
          : "/api/booking/catalog";

        if (!initialValues?.priceListId) {
          console.warn("Order missing priceListId, using fallback catalog");
        }

        const res = await fetch(catalogUrl, {
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
  }, [initialValues?.priceListId]);

  useEffect(() => {
    if (!initialValues) return;

    setProductCards(
      initialValues.productCards?.length
        ? initialValues.productCards
        : [createEmptyProductCard(0)],
    );
    setExpandedCardId(
      initialValues.productCards?.length
        ? initialValues.productCards[0].cardId
        : 0,
    );
    setCustomerLabel(initialValues.customerLabel ?? "");
    setOrderNumber(initialValues.orderNumber ?? "");
    setDescription(initialValues.description ?? "");
    setModelNr(initialValues.modelNr ?? "");
    setDeliveryDate(initialValues.deliveryDate ?? "");
    setTimeWindow(initialValues.timeWindow ?? "");
    setDeliveryAddress(initialValues.deliveryAddress ?? "");
    setDrivingDistance(initialValues.drivingDistance ?? "");
    setCustomerName(initialValues.customerName ?? "");
    setPhone(initialValues.phone ?? "");
    setPhoneTwo(initialValues.phoneTwo ?? "");
    setEmail(initialValues.email ?? "");
    setCustomerComments(initialValues.customerComments ?? "");
    setFloorNo(initialValues.floorNo ?? "");
    setLift(initialValues.lift ?? "");
    setCashierName(initialValues.cashierName ?? "");
    setCashierPhone(initialValues.cashierPhone ?? "");
    setSubcontractorId(initialValues.subcontractorId ?? "");
    setDriver(initialValues.driver ?? "");
    setSecondDriver(initialValues.secondDriver ?? "");
    setDriverInfo(initialValues.driverInfo ?? "");
    setLicensePlate(initialValues.licensePlate ?? "");
    setDeviation(initialValues.deviation ?? "");
    setFeeExtraWork(initialValues.feeExtraWork ?? false);
    setFeeAddToOrder(initialValues.feeAddToOrder ?? false);
    setStatusNotes(initialValues.statusNotes ?? "");
    setCustomerMembershipId(initialValues.customerMembershipId ?? "");
    setStatus(initialValues.status ?? "");
    setDontSendEmail(initialValues.dontSendEmail ?? false);
    setPickupAddress(initialValues.pickupAddress ?? "");
    setExtraPickups(
      (initialValues.extraPickupAddress ?? []).map((value, index) => ({
        id: `initial-${index}`,
        value,
      })),
    );

    setPriceExVat(initialValues.priceExVat ?? 0);
    setPriceSubcontractor(initialValues.priceSubcontractor ?? 0);
    setRabatt(initialValues.rabatt ?? "");
    setLeggTil(initialValues.leggTil ?? "");
    setSubcontractorMinus(initialValues.subcontractorMinus ?? "");
    setSubcontractorPlus(initialValues.subcontractorPlus ?? "");
  }, [initialValues]);

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

  const selectedCustomer = useMemo(
    () =>
      changeCustomerOptions.find(
        (option) => option.id === customerMembershipId,
      ) || (customerLabel ? { id: "", name: customerLabel } : undefined),
    [customerMembershipId, changeCustomerOptions, customerLabel],
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

  // Attachments
  const existingOrderId = initialValues?.id ?? null;

  async function handleUploadAttachment(file: File) {
    if (attachments.length >= 10) {
      setAttachmentsError("Max 10 attachments allowed");
      return;
    }
    try {
      setAttachmentsUploading(true);
      setAttachmentsError("");
      const formData = new FormData();
      formData.append("file", file);

      const url = existingOrderId
        ? `/api/orders/${existingOrderId}/attachments`
        : "/api/orders/pending-attachments";

      const res = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setAttachmentsError(data?.reason || "Upload failed");
        return;
      }

      setAttachments((prev) => [data.attachment, ...prev]);
    } catch {
      setAttachmentsError("Upload failed");
    } finally {
      setAttachmentsUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (existingOrderId) {
      setDeletedAttachmentIds((prev) =>
        prev.includes(attachmentId) ? prev : [...prev, attachmentId],
      );
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      return;
    }

    try {
      setAttachmentsError("");

      const res = await fetch(
        `/api/orders/pending-attachments/${attachmentId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setAttachmentsError(data?.reason || "Delete failed");
        return;
      }

      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
    } catch {
      setAttachmentsError("Delete failed");
    }
  }

  useEffect(() => {
    async function loadAttachments() {
      try {
        setAttachments([]);
        setAttachmentsError("");
        setDeletedAttachmentIds([]);

        const url = existingOrderId
          ? `/api/orders/${existingOrderId}/attachments`
          : "/api/orders/pending-attachments";

        const res = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.ok) {
          setAttachments(data.attachments ?? []);
          return;
        }

        setAttachments([]);
      } catch {
        setAttachments([]);
      }
    }

    void loadAttachments();
  }, [existingOrderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (saving) return;
    if (attachmentsUploading) {
      setSubmitError("Wait for attachments to finish uploading");
      return;
    }

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
      customerMembershipId,
      customerLabel,
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
      if (existingOrderId && deletedAttachmentIds.length > 0) {
        const deleteResults = await Promise.all(
          deletedAttachmentIds.map((attachmentId) =>
            fetch(`/api/orders/attachments/${attachmentId}`, {
              method: "DELETE",
              credentials: "include",
            }).catch(() => null),
          ),
        );

        const deleteFailed = deleteResults.some((res) => !res || !res.ok);

        if (deleteFailed) {
          setAttachmentsError("Some attachments could not be deleted.");
        } else {
          setDeletedAttachmentIds([]);
          setAttachmentsError("");
        }
      } else {
        setDeletedAttachmentIds([]);
        setAttachmentsError("");
      }

      setAttachments([]);
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
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="w-full lg:min-w-0 lg:flex-[1.6]">
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
            customerLabel={customerLabel}
            setCustomerLabel={setCustomerLabel}
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
            customerMembershipId={customerMembershipId}
            setCustomerMembershipId={setCustomerMembershipId}
            status={status}
            setStatus={setStatus}
            dontSendEmail={dontSendEmail}
            setDontSendEmail={setDontSendEmail}
            attachments={attachments}
            attachmentsUploading={attachmentsUploading}
            attachmentsError={attachmentsError}
            onUploadAttachment={handleUploadAttachment}
            onDeleteAttachment={handleDeleteAttachment}
          />
        </div>

        <div className="hidden lg:block lg:w-[420] lg:shrink-0">
          <div className="sticky top-4">
            <BookingCalculatorPanel
              calcOpen={calcOpen}
              setCalcOpen={setCalcOpen}
              productBreakdowns={productBreakdowns}
              priceLookup={priceLookup}
              adminView={dataset === "default"}
              onPriceChange={handlePriceChange}
              onAdjustmentsChange={handleAdjustmentsChange}
              sidebarMode
            />
          </div>
        </div>

        <div className="lg:hidden">
          <BookingCalculatorPanel
            calcOpen={calcOpen}
            setCalcOpen={setCalcOpen}
            productBreakdowns={productBreakdowns}
            priceLookup={priceLookup}
            adminView={dataset === "default"}
            onPriceChange={handlePriceChange}
            onAdjustmentsChange={handleAdjustmentsChange}
          />
        </div>
      </div>
    </form>
  );
}
