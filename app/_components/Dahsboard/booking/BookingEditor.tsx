"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import OrderFieldsForm from "@/app/_components/Dahsboard/booking/create/OrderFieldsForm";
import { loadUserOptions } from "@/lib/users/loadUserOptions";
import { getCreateOrderViewConfig } from "@/lib/booking/createOrderView";
import {
  SavedProductCard,
  createEmptyProductCard,
  normalizeSavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type {
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { ProductCardNew } from "@/app/_components/Dahsboard/booking/create/ProductCard";
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
import {
  DEFAULT_PHONE_PREFIX,
  getOptionalEmailError,
  getOptionalPhoneError,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
} from "@/lib/orders/contactValidation";
import {
  getExtraPickupValidation,
  normalizeExtraPickups,
} from "@/lib/orders/extraPickups";
import {
  createDefaultPriceListSettings,
  normalizePriceListSettings,
  type PriceListSettings,
} from "@/lib/products/priceListSettings";
import {
  type AttachmentCategory,
  type AttachmentItem,
} from "@/lib/orders/attachmentCategories";
import { ORDER_SLOT_LIMIT } from "@/lib/orders/capacity";

export type OrderFormPayload = {
  productCards: SavedProductCard[];

  orderNumber: string;
  description: string;
  modelNr: string;
  deliveryDate: string;
  timeWindow: string;
  expressDelivery: boolean;
  contactCustomerForCustomTimeWindow: boolean;
  customTimeContactNote: string;

  pickupAddress: string;
  extraPickups: {
    address: string;
    phone: string;
    email: string;
    sendEmail: boolean;
  }[];
  returnAddress: string;

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

type ExtraPickupDraft = {
  id: string;
} & OrderFormPayload["extraPickups"][number];

type FieldErrorMap = {
  deliveryDate: string | null;
  timeWindow: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  returnAddress: string | null;
  customerPhone: string | null;
  customerPhoneTwo: string | null;
  customerEmail: string | null;
  cashierPhone: string | null;
};

type Props = {
  hidden?: HiddenMask;
  hideDontSendEmail?: boolean;
  dataset?: "default" | "power";
  hideSubmitButton?: boolean;
  onSubmit?: (payload: OrderFormPayload) => void | Promise<void>;
  initialValues?: Partial<OrderFormPayload> & {
    id?: string;
  };
};

type CapacityWarningState = {
  count: number;
  limit: number;
  isOverCapacity: boolean;
  message: string;
} | null;

const PRESET_TIME_WINDOWS = ["10:00-16:00", "16:00-21:00"] as const;
const EMPTY_FIELD_ERRORS: FieldErrorMap = {
  deliveryDate: null,
  timeWindow: null,
  pickupAddress: null,
  deliveryAddress: null,
  returnAddress: null,
  customerPhone: null,
  customerPhoneTwo: null,
  customerEmail: null,
  cashierPhone: null,
};
const FIELD_ERROR_TARGETS: Record<keyof FieldErrorMap, string> = {
  deliveryDate: "order-delivery-date",
  timeWindow: "order-time-window",
  pickupAddress: "order-pickup-address",
  deliveryAddress: "order-delivery-address",
  returnAddress: "order-return-address",
  customerPhone: "order-customer-phone",
  customerPhoneTwo: "order-customer-phone-two",
  customerEmail: "order-customer-email",
  cashierPhone: "order-cashier-phone",
};

function parseDistanceKm(value: string) {
  const normalized = value.trim().replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return 0;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseTimeWindowState(value: string | undefined) {
  const normalized = normalizeInitialTimeWindow(value);

  if (!normalized) {
    return {
      selectedTimeWindow: "",
      customTimeFrom: "",
      customTimeTo: "",
    };
  }

  if (
    PRESET_TIME_WINDOWS.includes(
      normalized as (typeof PRESET_TIME_WINDOWS)[number],
    )
  ) {
    return {
      selectedTimeWindow: normalized,
      customTimeFrom: "",
      customTimeTo: "",
    };
  }

  const [from = "", to = ""] = normalized.split("-");
  const isCustomTimeRange =
    /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to);

  if (!isCustomTimeRange) {
    return {
      selectedTimeWindow: normalized,
      customTimeFrom: "",
      customTimeTo: "",
    };
  }

  return {
    selectedTimeWindow: "custom",
    customTimeFrom: from,
    customTimeTo: to,
  };
}

function normalizeInitialDeliveryDate(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const compactIsoMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactIsoMatch) {
    const [, year, month, day] = compactIsoMatch;
    return `${year}-${month}-${day}`;
  }

  const dottedMatch = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dottedMatch) {
    const [, day, month, year] = dottedMatch;
    return `${year}-${month}-${day}`;
  }

  return normalized;
}

function normalizeInitialTimeWindow(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "";
  }

  const rangeMatch = normalized.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!rangeMatch) {
    return normalized;
  }

  const [, from, to] = rangeMatch;
  return `${from}-${to}`;
}

function normalizeInitialLift(
  value: string | null | undefined,
): "yes" | "no" | "" {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["ja", "yes", "y", "true", "1"].includes(normalized)) {
    return "yes";
  }

  if (["nei", "no", "n", "false", "0"].includes(normalized)) {
    return "no";
  }

  return "";
}

function normalizeInitialStatus(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  switch (normalized) {
    case "behandles":
    case "behandling":
    case "processing":
      return "processing";
    case "bekreftet":
    case "confirmed":
      return "confirmed";
    case "aktiv":
    case "active":
      return "active";
    case "kansellert":
    case "kanselert":
    case "cancelled":
    case "canceled":
    case "avbrutt":
      return "cancelled";
    case "failed":
    case "feilet":
      return "failed";
    case "ferdig":
    case "completed":
      return "completed";
    case "fakturert":
    case "fakturet":
    case "invoiced":
      return "invoiced";
    case "betalt":
    case "paid":
      return "paid";
    default:
      return normalized || "processing";
  }
}

function isRecyclingReturnOption(
  option: CatalogSpecialOption | undefined,
): boolean {
  if (!option) {
    return false;
  }

  const normalizedCode = option.code.trim().toUpperCase();
  const normalizedLabel = (option.label ?? "").trim().toLowerCase();

  return (
    normalizedCode === "RETURNREC" || normalizedLabel.includes("gjenvinning")
  );
}

function scrollToPageTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function scrollToFieldTarget(targetId: string) {
  window.requestAnimationFrame(() => {
    const element = document.getElementById(targetId);

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.focus();
    }
  });
}

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
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [productCards, setProductCards] = useState<SavedProductCard[]>(
    initialValues?.productCards?.length
      ? initialValues.productCards.map((card, index) =>
          normalizeSavedProductCard(card, index),
        )
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
  const [priceListSettings, setPriceListSettings] = useState<PriceListSettings>(
    createDefaultPriceListSettings(),
  );
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
  const initialTimeWindowState = parseTimeWindowState(
    initialValues?.timeWindow,
  );
  const [deliveryDate, setDeliveryDate] = useState(
    normalizeInitialDeliveryDate(initialValues?.deliveryDate),
  );
  const [timeWindow, setTimeWindow] = useState(
    initialTimeWindowState.selectedTimeWindow,
  );
  const [expressDelivery, setExpressDelivery] = useState(
    initialValues?.expressDelivery ?? false,
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    initialValues?.deliveryAddress ?? "",
  );
  const [drivingDistance, setDrivingDistance] = useState(
    initialValues?.drivingDistance ?? "",
  );
  const [customerName, setCustomerName] = useState(
    initialValues?.customerName ?? "",
  );
  const [phone, setPhone] = useState(
    initialValues ? (initialValues.phone ?? "") : DEFAULT_PHONE_PREFIX,
  );
  const [phoneTwo, setPhoneTwo] = useState(
    initialValues ? (initialValues.phoneTwo ?? "") : DEFAULT_PHONE_PREFIX,
  );
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [customerComments, setCustomerComments] = useState(
    initialValues?.customerComments ?? "",
  );
  const [floorNo, setFloorNo] = useState(initialValues?.floorNo ?? "");
  const [lift, setLift] = useState<"yes" | "no" | "">(
    normalizeInitialLift(initialValues?.lift),
  );
  const [cashierName, setCashierName] = useState(
    initialValues?.cashierName ?? "",
  );
  const [cashierPhone, setCashierPhone] = useState(
    initialValues ? (initialValues.cashierPhone ?? "") : DEFAULT_PHONE_PREFIX,
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
  const [status, setStatus] = useState(
    normalizeInitialStatus(initialValues?.status),
  );
  const [dontSendEmail, setDontSendEmail] = useState(
    initialValues?.dontSendEmail ?? false,
  );
  const [
    contactCustomerForCustomTimeWindow,
    setContactCustomerForCustomTimeWindow,
  ] = useState(initialValues?.contactCustomerForCustomTimeWindow ?? false);
  const [customTimeContactNote, setCustomTimeContactNote] = useState(
    initialValues?.customTimeContactNote ?? "",
  );
  const [pickupAddress, setPickupAddress] = useState(
    initialValues?.pickupAddress ?? "",
  );
  const [extraPickups, setExtraPickups] = useState<ExtraPickupDraft[]>(
    initialValues?.extraPickups?.length
      ? initialValues.extraPickups.map((pickup, index) => ({
          id: `initial-${index}`,
          address: pickup.address ?? "",
          phone: pickup.phone?.trim() || DEFAULT_PHONE_PREFIX,
          email: pickup.email ?? "",
          sendEmail: pickup.sendEmail ?? true,
        }))
      : [],
  );
  const [returnAddress, setReturnAddress] = useState(
    initialValues?.returnAddress ?? "",
  );
  const [customTimeFrom, setCustomTimeFrom] = useState(
    initialTimeWindowState.customTimeFrom,
  );

  const [customTimeTo, setCustomTimeTo] = useState(
    initialTimeWindowState.customTimeTo,
  );

  const [subcontractorOptions, setSubcontractorOptions] = useState<
    UserOption[]
  >([]);
  const [subcontractorLoading, setSubcontractorLoading] = useState(false);

  const [changeCustomerOptions, setChangeCustomerOptions] = useState<
    UserOption[]
  >([]);
  const [changeCustomerLoading, setChangeCustomerLoading] = useState(false);
  const distanceRequestAbortRef = useRef<AbortController | null>(null);
  const previousSelectedCustomerIdRef = useRef<string | null>(null);
  const hasProcessedInitialReturnSyncRef = useRef(false);
  const lastUnlockedPickupAddressRef = useRef(
    initialValues?.pickupAddress ?? "",
  );
  const [capacityWarning, setCapacityWarning] =
    useState<CapacityWarningState>(null);
  const [capacityWarningLoading, setCapacityWarningLoading] = useState(false);

  const currentUser = useCurrentUser();
  const role = currentUser?.role ?? "USER";
  const permissions = (currentUser?.permissions ?? []) as AppPermission[];
  //Attachments
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState("");
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>(
    [],
  );
  const { effectiveHidden, effectiveHideDontSendEmail } =
    getCreateOrderViewConfig(role, permissions, hidden, hideDontSendEmail);
  const showAdminCalculatorAdjustments =
    !!initialValues?.id && (role === "OWNER" || role === "ADMIN");
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
          setPriceListSettings(createDefaultPriceListSettings());
          return;
        }

        setCatalogProducts(data.products ?? []);
        setCatalogSpecialOptions(data.specialOptions ?? []);
        setPriceListSettings(
          normalizePriceListSettings(data.priceListSettings),
        );
      } catch {
        setCatalogError("Failed to load catalog");
        setCatalogProducts([]);
        setCatalogSpecialOptions([]);
        setPriceListSettings(createDefaultPriceListSettings());
      } finally {
        setCatalogLoading(false);
      }
    }

    loadCatalog();
  }, [initialValues?.priceListId]);

  useEffect(() => {
    if (!initialValues) return;

    const nextTimeWindowState = parseTimeWindowState(initialValues.timeWindow);

    setProductCards(
      initialValues.productCards?.length
        ? initialValues.productCards.map((card, index) =>
            normalizeSavedProductCard(card, index),
          )
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
    setDeliveryDate(normalizeInitialDeliveryDate(initialValues.deliveryDate));
    setTimeWindow(nextTimeWindowState.selectedTimeWindow);
    setExpressDelivery(initialValues.expressDelivery ?? false);
    setDeliveryAddress(initialValues.deliveryAddress ?? "");
    setDrivingDistance(initialValues.drivingDistance ?? "");
    setCustomerName(initialValues.customerName ?? "");
    setPhone(initialValues.phone ?? "");
    setPhoneTwo(initialValues.phoneTwo ?? "");
    setEmail(initialValues.email ?? "");
    setCustomerComments(initialValues.customerComments ?? "");
    setFloorNo(initialValues.floorNo ?? "");
    setLift(normalizeInitialLift(initialValues.lift));
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
    previousSelectedCustomerIdRef.current =
      initialValues.customerMembershipId ?? null;
    setStatus(normalizeInitialStatus(initialValues.status));
    setDontSendEmail(initialValues.dontSendEmail ?? false);
    setContactCustomerForCustomTimeWindow(
      initialValues.contactCustomerForCustomTimeWindow ?? false,
    );
    setCustomTimeContactNote(initialValues.customTimeContactNote ?? "");
    setPickupAddress(initialValues.pickupAddress ?? "");
    setExtraPickups(
      (initialValues.extraPickups ?? []).map((pickup, index) => ({
        id: `initial-${index}`,
        address: pickup.address ?? "",
        phone: pickup.phone?.trim() || DEFAULT_PHONE_PREFIX,
        email: pickup.email ?? "",
        sendEmail: pickup.sendEmail ?? true,
      })),
    );
    setReturnAddress(initialValues.returnAddress ?? "");
    setCustomTimeFrom(nextTimeWindowState.customTimeFrom);
    setCustomTimeTo(nextTimeWindowState.customTimeTo);
    hasProcessedInitialReturnSyncRef.current = false;

    setPriceExVat(initialValues.priceExVat ?? 0);
    setPriceSubcontractor(initialValues.priceSubcontractor ?? 0);
    setRabatt(initialValues.rabatt ?? "");
    setLeggTil(initialValues.leggTil ?? "");
    setSubcontractorMinus(initialValues.subcontractorMinus ?? "");
    setSubcontractorPlus(initialValues.subcontractorPlus ?? "");
    setSubmitError("");
    setDidAttemptSubmit(false);
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
        {
          zeroBaseDeliveryPricesOver100Km:
            parseDistanceKm(drivingDistance) > 100,
        },
      ),
    [productCards, catalogProducts, catalogSpecialOptions, drivingDistance],
  );

  const calculatorBreakdowns = useMemo(() => {
    const nextBreakdowns = [...productBreakdowns];
    const extraItems: Array<{
      kind: "customPrice";
      code: string;
      label: string;
      qty: number;
      unitPrice: number;
    }> = [];
    const extraPickupCount = extraPickups
      .map((pickup) => pickup.address.trim())
      .filter(Boolean).length;
    const extraPickupPrice = Number(
      priceListSettings.extraPickup.price.replace(",", "."),
    );
    const totalDistanceKm = parseDistanceKm(drivingDistance);
    const kmFrom21Qty = Math.max(0, Math.min(totalDistanceKm, 100) - 21);
    const kmOver100Qty = Math.max(0, totalDistanceKm - 100);
    const kmFrom21Price = Number(
      priceListSettings.kmFrom21.price.replace(",", "."),
    );
    const kmOver100Price = Number(
      priceListSettings.kmOver100.price.replace(",", "."),
    );

    if (
      extraPickupCount > 0 &&
      Number.isFinite(extraPickupPrice) &&
      extraPickupPrice > 0
    ) {
      extraItems.push({
        kind: "customPrice",
        code: priceListSettings.extraPickup.code,
        label: priceListSettings.extraPickup.description,
        qty: extraPickupCount,
        unitPrice: extraPickupPrice,
      });
    }

    const expressDeliveryPrice = Number(
      priceListSettings.expressDelivery.price.replace(",", "."),
    );

    if (expressDelivery && Number.isFinite(expressDeliveryPrice)) {
      extraItems.push({
        kind: "customPrice",
        code: priceListSettings.expressDelivery.code,
        label: priceListSettings.expressDelivery.description,
        qty: 1,
        unitPrice: expressDeliveryPrice,
      });
    }

    if (kmFrom21Qty > 0 && Number.isFinite(kmFrom21Price)) {
      extraItems.push({
        kind: "customPrice",
        code: priceListSettings.kmFrom21.code,
        label: priceListSettings.kmFrom21.description,
        qty: kmFrom21Qty,
        unitPrice: kmFrom21Price,
      });
    }

    if (kmOver100Qty > 0 && Number.isFinite(kmOver100Price)) {
      extraItems.push({
        kind: "customPrice",
        code: priceListSettings.kmOver100.code,
        label: priceListSettings.kmOver100.description,
        qty: kmOver100Qty,
        unitPrice: kmOver100Price,
      });
    }

    if (extraItems.length > 0) {
      nextBreakdowns.push({
        productName: "Order extras",
        items: extraItems,
      });
    }

    return nextBreakdowns;
  }, [
    drivingDistance,
    expressDelivery,
    extraPickups,
    priceListSettings.extraPickup.code,
    priceListSettings.extraPickup.description,
    priceListSettings.extraPickup.price,
    priceListSettings.expressDelivery.code,
    priceListSettings.expressDelivery.description,
    priceListSettings.expressDelivery.price,
    priceListSettings.kmFrom21.code,
    priceListSettings.kmFrom21.description,
    priceListSettings.kmFrom21.price,
    priceListSettings.kmOver100.code,
    priceListSettings.kmOver100.description,
    priceListSettings.kmOver100.price,
    productBreakdowns,
  ]);

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

  //For locking pickupadress when isonlyreturn or install
  const shouldLockPickupAddress = useMemo(
    () =>
      productCards.length > 0 &&
      productCards.every(
        (card) =>
          card.deliveryType === DELIVERY_TYPES.INSTALL_ONLY ||
          card.deliveryType === DELIVERY_TYPES.RETURN_ONLY,
      ),
    [productCards],
  );

  const hasSelectedReturnOption = useMemo(
    () => productCards.some((card) => !!card.selectedReturnOptionId),
    [productCards],
  );
  const shouldShowReturnAddress = useMemo(
    () =>
      productCards.some((card) => {
        if (!card.selectedReturnOptionId) {
          return false;
        }

        const selectedReturnOption = catalogSpecialOptions.find(
          (option) => option.id === card.selectedReturnOptionId,
        );

        if (!selectedReturnOption) {
          return true;
        }

        return !isRecyclingReturnOption(selectedReturnOption);
      }),
    [catalogSpecialOptions, productCards],
  );
  const hadVisibleReturnAddressRef = useRef(shouldShowReturnAddress);

  const selectedSubcontractor = useMemo(
    () => subcontractorOptions.find((option) => option.id === subcontractorId),
    [subcontractorId, subcontractorOptions],
  );
  const selectedCustomerOption = useMemo(() => {
    if (customerMembershipId) {
      return (
        changeCustomerOptions.find(
          (option) => option.id === customerMembershipId,
        ) ?? null
      );
    }

    if (!currentUser?.email) {
      return null;
    }

    return (
      changeCustomerOptions.find(
        (option) => option.email === currentUser.email,
      ) ?? null
    );
  }, [changeCustomerOptions, currentUser?.email, customerMembershipId]);
  const selectedCustomerAddress = selectedCustomerOption?.address?.trim() ?? "";
  const finalTimeWindow =
    timeWindow === "custom" ? `${customTimeFrom}-${customTimeTo}` : timeWindow;
  useEffect(() => {
    const normalizedDeliveryDate = deliveryDate.trim();
    const normalizedTimeWindow = finalTimeWindow.trim();

    if (!normalizedDeliveryDate || !normalizedTimeWindow) {
      setCapacityWarning(null);
      setCapacityWarningLoading(false);
      return;
    }

    if (
      timeWindow === "custom" &&
      (!customTimeFrom.trim() || !customTimeTo.trim())
    ) {
      setCapacityWarning(null);
      setCapacityWarningLoading(false);
      return;
    }

    const abortController = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        setCapacityWarningLoading(true);

        const searchParams = new URLSearchParams({
          deliveryDate: normalizedDeliveryDate,
          timeWindow: normalizedTimeWindow,
        });

        if (initialValues?.id) {
          searchParams.set("excludeOrderId", initialValues.id);
        }

        const response = await fetch(
          `/api/orders/capacity?${searchParams.toString()}`,
          {
            credentials: "include",
            cache: "no-store",
            signal: abortController.signal,
          },
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.ok) {
          setCapacityWarning(null);
          return;
        }

        setCapacityWarning({
          count: typeof data.count === "number" ? data.count : 0,
          limit: typeof data.limit === "number" ? data.limit : 15,
          isOverCapacity: Boolean(data.isOverCapacity),
          message: typeof data.message === "string" ? data.message : "",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCapacityWarning(null);
      } finally {
        setCapacityWarningLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [
    customTimeFrom,
    customTimeTo,
    deliveryDate,
    finalTimeWindow,
    initialValues?.id,
    timeWindow,
  ]);
  const normalizedEmail = normalizeOptionalEmail(email) ?? "";
  const normalizedPhone = normalizeOptionalPhone(phone) ?? "";
  const normalizedPhoneTwo = normalizeOptionalPhone(phoneTwo) ?? "";
  const normalizedCashierPhone = normalizeOptionalPhone(cashierPhone) ?? "";
  const normalizedFloorNo = floorNo.trim();
  const normalizedLift = normalizedFloorNo ? lift : "";
  const shouldSuppressEmailForCustomTimeWindow =
    timeWindow === "custom" && contactCustomerForCustomTimeWindow;
  const normalizedCustomTimeContactNote =
    timeWindow === "custom" && contactCustomerForCustomTimeWindow
      ? customTimeContactNote.trim()
      : "";
  const requiresDeliveryDate = shown(effectiveHidden, OrderFields.DeliveryDate);
  const requiresTimeWindow = shown(
    effectiveHidden,
    OrderFields.DeliveryTimeWindow,
  );
  const requiresPickupAddress = shown(
    effectiveHidden,
    OrderFields.PickupLocations,
  );
  const requiresReturnAddress =
    shown(effectiveHidden, OrderFields.DeliveryAddress) &&
    shouldShowReturnAddress;
  const requiresDeliveryAddress = shown(
    effectiveHidden,
    OrderFields.DeliveryAddress,
  );
  const requiresCustomerPhone = shown(
    effectiveHidden,
    OrderFields.CustomerPhone1,
  );
  const emailError = getOptionalEmailError(email);
  const phoneError = getOptionalPhoneError(phone);
  const phoneTwoError = getOptionalPhoneError(phoneTwo);
  const cashierPhoneError = getOptionalPhoneError(cashierPhone);
  const extraPickupErrors = useMemo(
    () => extraPickups.map((pickup) => getExtraPickupValidation(pickup)),
    [extraPickups],
  );
  const computedFieldErrors = useMemo(
    (): FieldErrorMap => ({
      deliveryDate:
        requiresDeliveryDate && !deliveryDate.trim()
          ? "Delivery date is required"
          : null,
      timeWindow:
        requiresTimeWindow && !finalTimeWindow.trim()
          ? "Delivery time window is required"
          : requiresTimeWindow &&
              timeWindow === "custom" &&
              (!customTimeFrom || !customTimeTo)
            ? "Custom time requires both from and to"
            : null,
      pickupAddress:
        requiresPickupAddress && !pickupAddress.trim()
          ? "Pickup address is required"
          : null,
      deliveryAddress:
        requiresDeliveryAddress && !deliveryAddress.trim()
          ? "Delivery address is required"
          : null,
      returnAddress:
        requiresReturnAddress && !returnAddress.trim()
          ? "Return address is required"
          : null,
      customerPhone:
        phoneError ??
        (requiresCustomerPhone && !normalizedPhone
          ? "Customer phone is required"
          : null),
      customerPhoneTwo: phoneTwoError,
      customerEmail: emailError,
      cashierPhone: cashierPhoneError,
    }),
    [
      cashierPhoneError,
      customTimeFrom,
      customTimeTo,
      deliveryAddress,
      deliveryDate,
      emailError,
      finalTimeWindow,
      normalizedPhone,
      phoneError,
      phoneTwoError,
      pickupAddress,
      requiresCustomerPhone,
      requiresDeliveryAddress,
      requiresDeliveryDate,
      requiresPickupAddress,
      requiresReturnAddress,
      requiresTimeWindow,
      returnAddress,
      timeWindow,
    ],
  );
  const visibleFieldErrors = didAttemptSubmit
    ? computedFieldErrors
    : EMPTY_FIELD_ERRORS;

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

  useEffect(() => {
    if (!shouldShowReturnAddress && returnAddress) {
      setReturnAddress("");
    }
  }, [returnAddress, shouldShowReturnAddress]);

  useEffect(() => {
    if (shouldLockPickupAddress || pickupAddress === "No shop pickup address") {
      return;
    }

    lastUnlockedPickupAddressRef.current = pickupAddress;
  }, [pickupAddress, shouldLockPickupAddress]);

  useEffect(() => {
    const selectedCustomerId = selectedCustomerOption?.id ?? null;
    const previousSelectedCustomerId = previousSelectedCustomerIdRef.current;

    previousSelectedCustomerIdRef.current = selectedCustomerId;

    if (
      !selectedCustomerOption ||
      previousSelectedCustomerId === selectedCustomerId
    ) {
      return;
    }

    if (previousSelectedCustomerId === null && initialValues?.id) {
      return;
    }

    setCustomerLabel(selectedCustomerOption.name);
    setPickupAddress(selectedCustomerAddress);

    if (shouldShowReturnAddress) {
      setReturnAddress(selectedCustomerAddress);
    }
  }, [
    initialValues?.id,
    selectedCustomerAddress,
    selectedCustomerOption,
    shouldShowReturnAddress,
  ]);

  useEffect(() => {
    const hadVisibleReturnAddress = hadVisibleReturnAddressRef.current;
    hadVisibleReturnAddressRef.current = shouldShowReturnAddress;

    if (!hasProcessedInitialReturnSyncRef.current) {
      hasProcessedInitialReturnSyncRef.current = true;

      if (initialValues?.id) {
        return;
      }
    }

    if (!shouldShowReturnAddress || hadVisibleReturnAddress) {
      return;
    }

    setReturnAddress(selectedCustomerAddress);
  }, [initialValues?.id, selectedCustomerAddress, shouldShowReturnAddress]);

  useEffect(() => {
    if (!floorNo.trim() && lift) {
      setLift("");
    }
  }, [floorNo, lift]);

  useEffect(() => {
    const extraPickupAddresses = extraPickups
      .map((pickup) => pickup.address)
      .filter((address) => address.trim().length > 0);
    const routeRequest = {
      pickupAddress,
      extraPickupAddresses,
      deliveryAddress,
      returnAddress: shouldShowReturnAddress ? returnAddress : "",
    };

    distanceRequestAbortRef.current?.abort();

    const abortController = new AbortController();
    distanceRequestAbortRef.current = abortController;

    const hasAtLeastTwoCandidateStops =
      [
        routeRequest.pickupAddress,
        ...routeRequest.extraPickupAddresses,
        routeRequest.deliveryAddress,
        routeRequest.returnAddress,
      ].filter((address) => address.trim().length > 0).length >= 2;

    if (!hasAtLeastTwoCandidateStops) {
      setDrivingDistance("");
      return () => {
        abortController.abort();
        if (distanceRequestAbortRef.current === abortController) {
          distanceRequestAbortRef.current = null;
        }
      };
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/route-distance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(routeRequest),
          signal: abortController.signal,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.ok || typeof data.distanceKm !== "string") {
          return;
        }

        setDrivingDistance((current) =>
          current === data.distanceKm ? current : data.distanceKm,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      abortController.abort();
      if (distanceRequestAbortRef.current === abortController) {
        distanceRequestAbortRef.current = null;
      }
    };
  }, [
    deliveryAddress,
    extraPickups,
    pickupAddress,
    returnAddress,
    shouldShowReturnAddress,
  ]);

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
      throw new Error(
        data?.message || data?.reason || "Failed to create order",
      );
    }
  }

  // Attachments
  const existingOrderId = initialValues?.id ?? null;

  async function handleUploadAttachment(
    file: File,
    category: AttachmentCategory,
  ) {
    if (attachments.length >= 10) {
      setAttachmentsError("Max 10 attachments allowed");
      return;
    }
    try {
      setAttachmentsUploading(true);
      setAttachmentsError("");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

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
    setDidAttemptSubmit(true);

    const hasExtraPickupValidationError = extraPickupErrors.some(
      (validation) =>
        validation.contactError ||
        validation.phoneError ||
        validation.emailError,
    );
    const firstFieldErrorKey = (
      Object.keys(computedFieldErrors) as Array<keyof FieldErrorMap>
    ).find((key) => computedFieldErrors[key]);

    if (firstFieldErrorKey || hasExtraPickupValidationError) {
      setSubmitError("");

      if (firstFieldErrorKey) {
        scrollToFieldTarget(FIELD_ERROR_TARGETS[firstFieldErrorKey]);
        return;
      }

      const firstExtraPickupError = extraPickups.find((pickup, index) => {
        const validation = extraPickupErrors[index];
        return (
          validation?.contactError ||
          validation?.phoneError ||
          validation?.emailError
        );
      });

      if (!firstExtraPickupError) {
        return;
      }

      const extraPickupErrorTarget = (() => {
        const validation =
          extraPickupErrors[
            extraPickups.findIndex(
              (pickup) => pickup.id === firstExtraPickupError.id,
            )
          ];

        if (validation?.phoneError || validation?.contactError) {
          return `extra-pickup-${firstExtraPickupError.id}-phone`;
        }

        return `extra-pickup-${firstExtraPickupError.id}-email`;
      })();

      scrollToFieldTarget(extraPickupErrorTarget);
      return;
    }

    const normalizedExtraPickups = normalizeExtraPickups(
      extraPickups.map(({ id: _id, ...pickup }) => pickup),
    ).filter((pickup) => pickup.address);

    const payload: OrderFormPayload = {
      productCards,

      orderNumber,
      description,
      modelNr,
      deliveryDate,
      timeWindow: finalTimeWindow,
      expressDelivery,
      contactCustomerForCustomTimeWindow:
        timeWindow === "custom" && contactCustomerForCustomTimeWindow,
      customTimeContactNote: normalizedCustomTimeContactNote,
      pickupAddress,
      extraPickups: normalizedExtraPickups,
      returnAddress,
      deliveryAddress,
      drivingDistance,

      customerName,
      phone: normalizedPhone,
      phoneTwo: normalizedPhoneTwo,
      email: normalizedEmail,
      customerComments,

      floorNo: normalizedFloorNo,
      lift: normalizedLift,

      cashierName,
      cashierPhone: normalizedCashierPhone,

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
      dontSendEmail: dontSendEmail || shouldSuppressEmailForCustomTimeWindow,

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
      setDidAttemptSubmit(false);
      scrollToPageTop();
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : "Failed to save order",
      );
    } finally {
      setSaving(false);
    }
  };

  //for controling express delivery checkbox, if delivery is in less than 2 days, turns on
  useEffect(() => {
    if (!deliveryDate) {
      setExpressDelivery(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);

    const diffDays =
      (delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    setExpressDelivery(diffDays <= 1);
  }, [deliveryDate]);

  //For locking pickupadress when isonlyreturn or install
  useEffect(() => {
    if (shouldLockPickupAddress) {
      setPickupAddress("No shop pickup address");
      setExtraPickups([]);
      return;
    }

    setPickupAddress((current) =>
      current === "No shop pickup address"
        ? lastUnlockedPickupAddressRef.current || selectedCustomerAddress
        : current,
    );
  }, [selectedCustomerAddress, shouldLockPickupAddress]);

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
            shouldLockPickupAddress={shouldLockPickupAddress}
            hideSubmitButton={hideSubmitButton}
            subcontractorLoading={subcontractorLoading}
            subcontractorOptions={subcontractorOptions}
            changeCustomerLoading={changeCustomerLoading}
            changeCustomerOptions={changeCustomerOptions}
            saving={saving}
            submitError={submitError}
            deliveryDateError={visibleFieldErrors.deliveryDate}
            timeWindowError={visibleFieldErrors.timeWindow}
            pickupAddressError={visibleFieldErrors.pickupAddress}
            deliveryAddressError={visibleFieldErrors.deliveryAddress}
            returnAddressError={visibleFieldErrors.returnAddress}
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
            expressDelivery={expressDelivery}
            setExpressDelivery={setExpressDelivery}
            pickupAddress={pickupAddress}
            setPickupAddress={setPickupAddress}
            extraPickups={extraPickups}
            setExtraPickups={setExtraPickups}
            returnAddress={returnAddress}
            setReturnAddress={setReturnAddress}
            customTimeFrom={customTimeFrom}
            setCustomTimeFrom={setCustomTimeFrom}
            customTimeTo={customTimeTo}
            setCustomTimeTo={setCustomTimeTo}
            contactCustomerForCustomTimeWindow={
              contactCustomerForCustomTimeWindow
            }
            setContactCustomerForCustomTimeWindow={
              setContactCustomerForCustomTimeWindow
            }
            customTimeContactNote={customTimeContactNote}
            setCustomTimeContactNote={setCustomTimeContactNote}
            deliveryAddress={deliveryAddress}
            setDeliveryAddress={setDeliveryAddress}
            shouldShowReturnAddress={shouldShowReturnAddress}
            drivingDistance={drivingDistance}
            setDrivingDistance={setDrivingDistance}
            customerName={customerName}
            setCustomerName={setCustomerName}
            phone={phone}
            setPhone={setPhone}
            phoneError={visibleFieldErrors.customerPhone}
            phoneTwo={phoneTwo}
            setPhoneTwo={setPhoneTwo}
            phoneTwoError={visibleFieldErrors.customerPhoneTwo}
            email={email}
            setEmail={setEmail}
            emailError={visibleFieldErrors.customerEmail}
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
            cashierPhoneError={visibleFieldErrors.cashierPhone}
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
            capacityWarningMessage={
              capacityWarning?.isOverCapacity ? capacityWarning.message : ""
            }
            capacityWarningCount={capacityWarning?.count ?? 0}
            capacityWarningLimit={capacityWarning?.limit ?? ORDER_SLOT_LIMIT}
            capacityWarningLoading={capacityWarningLoading}
          />
        </div>

        <div className="hidden lg:block lg:w-[420] lg:shrink-0">
          <div className=" top-[86] z-10 w-[420]" style={{ right: "16px" }}>
            <BookingCalculatorPanel
              calcOpen={calcOpen}
              setCalcOpen={setCalcOpen}
              productBreakdowns={calculatorBreakdowns}
              priceLookup={priceLookup}
              adminView={
                dataset === "default" && showAdminCalculatorAdjustments
              }
              onPriceChange={handlePriceChange}
              rabatt={rabatt}
              leggTil={leggTil}
              subcontractorMinus={subcontractorMinus}
              subcontractorPlus={subcontractorPlus}
              onAdjustmentsChange={handleAdjustmentsChange}
              sidebarMode
            />
          </div>
        </div>

        <div className="lg:hidden">
          <BookingCalculatorPanel
            calcOpen={calcOpen}
            setCalcOpen={setCalcOpen}
            productBreakdowns={calculatorBreakdowns}
            priceLookup={priceLookup}
            adminView={dataset === "default" && showAdminCalculatorAdjustments}
            onPriceChange={handlePriceChange}
            rabatt={rabatt}
            leggTil={leggTil}
            subcontractorMinus={subcontractorMinus}
            subcontractorPlus={subcontractorPlus}
            onAdjustmentsChange={handleAdjustmentsChange}
          />
        </div>
      </div>
    </form>
  );
}
