"use client";

import { useEffect, useMemo, useState } from "react";
import { OPTION_CATEGORIES, OPTION_CODES } from "@/lib/booking/constants";
import {
  normalizeProductCustomSections,
  type ProductCustomSection,
} from "@/lib/products/customSections";
import {
  createDefaultProductDeliveryTypes,
  normalizeProductDeliveryTypes,
  type ProductDeliveryType,
} from "@/lib/products/deliveryTypes";
import {
  createDefaultPriceListSettings,
  normalizePriceListSettings,
  type PriceListSettings,
} from "@/lib/products/priceListSettings";
import { DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";

type PriceListSummary = {
  id: string;
  name: string;
  code: string;
};

type PriceListItem = {
  id: string;
  productId?: string;
  productOptionId?: string;
  productName?: string;
  productCode?: string;
  productType?: "PHYSICAL" | "PALLET" | "LABOR";
  allowDeliveryTypes?: boolean;
  allowQuantity?: boolean;
  allowInstallOptions?: boolean;
  allowReturnOptions?: boolean;
  allowExtraServices?: boolean;
  allowDemont?: boolean;
  allowPeopleCount?: boolean;
  allowHoursInput?: boolean;
  allowModelNumber?: boolean;
  autoXtraPerPallet?: boolean;
  deliveryTypes?: ProductDeliveryType[];
  customSections?: ProductCustomSection[];
  optionCode: string;
  optionLabel?: string | null;
  description: string | null;
  category?: string | null;
  sortOrder: number;
  customerPrice: string;
  subcontractorPrice: string;
  discountAmount: string;
  discountEndsAt: string | null;
  effectiveCustomerPrice: string;
  isActive: boolean;
  type?: string;
};

type EditableRow = PriceListItem & {
  productType?: "PHYSICAL" | "PALLET" | "LABOR";
  allowDeliveryTypes?: boolean;
  allowQuantity?: boolean;
  allowInstallOptions?: boolean;
  allowReturnOptions?: boolean;
  allowExtraServices?: boolean;
  allowDemont?: boolean;
  allowPeopleCount?: boolean;
  allowHoursInput?: boolean;
  allowModelNumber?: boolean;
  autoXtraPerPallet?: boolean;
  deliveryTypes?: ProductDeliveryType[];
  customSections?: ProductCustomSection[];

  saving?: boolean;
  saved?: boolean;
  error?: string | null;
};

type PriceListData = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  settings: PriceListSettings;
  isActive: boolean;
  items: PriceListItem[];
  specialOptions: PriceListItem[];
};

type ProductSettingsDraft = {
  productType: "PHYSICAL" | "PALLET" | "LABOR";
  allowDeliveryTypes: boolean;
  allowQuantity: boolean;
  allowInstallOptions: boolean;
  allowReturnOptions: boolean;
  allowExtraServices: boolean;
  allowDemont: boolean;
  allowPeopleCount: boolean;
  allowHoursInput: boolean;
  allowModelNumber: boolean;
  autoXtraPerPallet: boolean;
  deliveryTypes: ProductDeliveryType[];
  customSections: ProductCustomSection[];
};

function createDraftId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildProductSettingsDefaults(
  productType: ProductSettingsDraft["productType"],
): ProductSettingsDraft {
  switch (productType) {
    case "PALLET":
      return {
        productType: "PALLET",
        allowDeliveryTypes: true,
        allowQuantity: true,
        allowInstallOptions: false,
        allowReturnOptions: false,
        allowExtraServices: false,
        allowDemont: false,
        allowPeopleCount: false,
        allowHoursInput: false,
        allowModelNumber: true,
        autoXtraPerPallet: true,
        deliveryTypes: createDefaultProductDeliveryTypes(),
        customSections: [],
      };
    case "LABOR":
      return {
        productType: "LABOR",
        allowDeliveryTypes: false,
        allowQuantity: false,
        allowInstallOptions: true,
        allowReturnOptions: false,
        allowExtraServices: false,
        allowDemont: false,
        allowPeopleCount: false,
        allowHoursInput: true,
        allowModelNumber: true,
        autoXtraPerPallet: false,
        deliveryTypes: createDefaultProductDeliveryTypes(),
        customSections: [],
      };
    case "PHYSICAL":
    default:
      return {
        productType: "PHYSICAL",
        allowDeliveryTypes: true,
        allowQuantity: true,
        allowInstallOptions: true,
        allowReturnOptions: true,
        allowExtraServices: true,
        allowDemont: false,
        allowPeopleCount: false,
        allowHoursInput: false,
        allowModelNumber: true,
        autoXtraPerPallet: false,
        deliveryTypes: createDefaultProductDeliveryTypes(),
        customSections: [],
      };
  }
}

function getDeliveryTypeEditorTitle(key: ProductDeliveryType["key"]) {
  switch (key) {
    case "FIRST_STEP":
      return "Delivery";
    case "INDOOR":
      return "Innbæring";
    case "INSTALL_ONLY":
      return "Install only";
    case "RETURN_ONLY":
      return "Return only";
    default:
      return key;
  }
}

function supportsXtraPrice(key: ProductDeliveryType["key"]) {
  return false;
}

function getDeliveryTypePricePlaceholder(key: ProductDeliveryType["key"]) {
  switch (key) {
    case "FIRST_STEP":
      return "Delivery price";
    case "INDOOR":
      return "Innbæring price";
    case "INSTALL_ONLY":
      return "Install only price";
    case "RETURN_ONLY":
      return "Return only price";
    default:
      return "Price";
  }
}

function getDeliveryTypeXtraPlaceholder(key: ProductDeliveryType["key"]) {
  switch (key) {
    case "FIRST_STEP":
      return "Extra levering price";
    case "INDOOR":
      return "Extra innbæring price";
    default:
      return "XTRA price";
  }
}

const PRODUCT_SETTING_FIELDS: Array<{
  key: keyof Pick<
    ProductSettingsDraft,
    | "allowDeliveryTypes"
    | "allowQuantity"
    | "allowInstallOptions"
    | "allowReturnOptions"
    | "allowExtraServices"
    | "allowHoursInput"
    | "allowModelNumber"
    | "autoXtraPerPallet"
  >;
  label: string;
}> = [
  { key: "allowDeliveryTypes", label: "Delivery type selection" },
  { key: "allowQuantity", label: "Quantity" },
  { key: "allowInstallOptions", label: "Install options" },
  { key: "allowReturnOptions", label: "Return options" },
  { key: "allowExtraServices", label: "Utpakking / Demontering" },
  { key: "allowHoursInput", label: "Hours input" },
  { key: "allowModelNumber", label: "Model number input" },
  { key: "autoXtraPerPallet", label: "Automatic pallet XTRA" },
];

function isReturnRow(
  item: Pick<
    EditableRow,
    | "type"
    | "productId"
    | "category"
    | "optionCode"
    | "optionLabel"
    | "description"
  >,
) {
  return !item.productId && item.type === "return";
}

function isXtraRow(
  item: Pick<
    EditableRow,
    | "type"
    | "productId"
    | "category"
    | "optionCode"
    | "optionLabel"
    | "description"
  >,
) {
  return !item.productId && item.type === "xtra";
}

type AutomaticXtraKind = "INDOOR" | "FIRST_STEP";

function normalizeAutomaticXtraText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function inferAutomaticXtraKind(
  item: Pick<EditableRow, "optionCode" | "optionLabel" | "description">,
): AutomaticXtraKind {
  const signal = [
    normalizeAutomaticXtraText(item.optionCode),
    normalizeAutomaticXtraText(item.optionLabel),
    normalizeAutomaticXtraText(item.description),
  ].join(" ");

  if (
    signal.includes("first_step") ||
    signal.includes("first step") ||
    signal.includes("levering") ||
    signal.includes("delivery")
  ) {
    return "FIRST_STEP";
  }

  return "INDOOR";
}

function buildAutomaticXtraDraft(kind: AutomaticXtraKind) {
  if (kind === "FIRST_STEP") {
    return {
      code: "XTRAFIRST",
      label: "XTRA",
      description: "Ekstra levering",
    };
  }

  return {
    code: "XTRA",
    label: "XTRA",
    description: "Ekstra innbæring",
  };
}

function isExtraServiceRow(
  item: Pick<
    EditableRow,
    | "type"
    | "productId"
    | "category"
    | "optionCode"
    | "optionLabel"
    | "description"
  >,
) {
  return !item.productId && item.type === "extra_service";
}



export default function EditPricesPage() {
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(
    null,
  );
  const [priceLists, setPriceLists] = useState<PriceListSummary[]>([]);
  const [priceList, setPriceList] = useState<PriceListData | null>(null);
  const [creatingPriceList, setCreatingPriceList] = useState(false);
  const [editingPriceListName, setEditingPriceListName] = useState("");
  const [editingPriceListSettings, setEditingPriceListSettings] = useState(false);
  const [priceListSettingsDraft, setPriceListSettingsDraft] =
    useState<PriceListSettings>(createDefaultPriceListSettings());
  const [savingPriceListSettings, setSavingPriceListSettings] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [originalRows, setOriginalRows] = useState<
    Record<string, PriceListItem>
  >({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productSettingsDraft, setProductSettingsDraft] =
    useState<ProductSettingsDraft | null>(null);
  const [savingProductSettings, setSavingProductSettings] = useState(false);
  const [productSettingsError, setProductSettingsError] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activePriceListSummary = useMemo(() => {
    if (!priceLists.length) return null;

    if (selectedPriceListId) {
      const selected = priceLists.find(
        (item) => item.id === selectedPriceListId,
      );
      if (selected) return selected;
    }

    return priceLists[0] ?? null;
  }, [priceLists, selectedPriceListId]);

  const canEditActivePriceListName =
    !!activePriceListSummary && activePriceListSummary.code !== "DEFAULT";
  const canEditActivePriceListSettings = !!activePriceListSummary;

  useEffect(() => {
    async function loadPriceLists() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/products/pricelists", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.reason ?? "Failed to load price lists");
          setPriceLists([]);
          return;
        }

        const nextPriceLists = data.priceLists ?? [];

        setPriceLists(nextPriceLists);

        setSelectedPriceListId((current) => {
          if (
            current &&
            nextPriceLists.some((item: PriceListSummary) => item.id === current)
          ) {
            return current;
          }

          return nextPriceLists[0]?.id ?? null;
        });
      } catch {
        setError("Something went wrong while loading price lists");
        setPriceLists([]);
      } finally {
        setLoading(false);
      }
    }

    loadPriceLists();
  }, []);

  useEffect(() => {
    async function loadActivePriceList() {
      if (!activePriceListSummary) {
        setPriceList(null);
        setPriceListSettingsDraft(createDefaultPriceListSettings());
        setRows([]);
        setOriginalRows({});
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/products/pricelists/${activePriceListSummary.id}`,
          { cache: "no-store" },
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.reason ?? "Failed to load price list");
          setPriceList(null);
          setPriceListSettingsDraft(createDefaultPriceListSettings());
          setRows([]);
          setOriginalRows({});
          return;
        }

        setPriceList(data.priceList);
        setPriceListSettingsDraft(
          normalizePriceListSettings(data.priceList.settings),
        );

        const combinedRows: EditableRow[] = [
          ...(data.priceList.items ?? []),
          ...(data.priceList.specialOptions ?? []),
        ];

        setRows(combinedRows);

        const originals = combinedRows.reduce(
          (acc: Record<string, PriceListItem>, item: PriceListItem) => {
            acc[item.id] = item;
            return acc;
          },
          {},
        );

        setOriginalRows(originals);
      } catch {
        setError("Something went wrong while loading price list");
        setPriceList(null);
        setPriceListSettingsDraft(createDefaultPriceListSettings());
        setRows([]);
        setOriginalRows({});
      } finally {
        setLoading(false);
      }
    }

    loadActivePriceList();
  }, [activePriceListSummary]);

  function updateRow(itemId: string, patch: Partial<EditableRow>) {
    setRows((current) =>
      current.map((row) =>
        row.id === itemId
          ? {
              ...row,
              ...patch,
              saved: false,
              error: null,
            }
          : row,
      ),
    );
  }

  function updateProductRows(productId: string, patch: Partial<EditableRow>) {
    setRows((current) =>
      current.map((row) =>
        row.productId != null && row.productId === productId
          ? {
              ...row,
              ...patch,
              saved: false,
              error: null,
            }
          : row,
      ),
    );
  }

  function openProductSettings(productId: string) {
    const row = rows.find((item) => item.productId === productId);
    if (!row) return;

    setEditingProductId(productId);
    setProductSettingsDraft({
      ...buildProductSettingsDefaults(row.productType ?? "PHYSICAL"),
      productType: row.productType ?? "PHYSICAL",
      allowDeliveryTypes: row.allowDeliveryTypes ?? true,
      allowQuantity: row.allowQuantity ?? true,
      allowInstallOptions: row.allowInstallOptions ?? true,
      allowReturnOptions: row.allowReturnOptions ?? true,
      allowExtraServices: row.allowExtraServices ?? true,
      allowDemont: false,
      allowPeopleCount: false,
      allowHoursInput: row.allowHoursInput ?? false,
      allowModelNumber: row.allowModelNumber ?? true,
      autoXtraPerPallet:
        row.autoXtraPerPallet ??
        buildProductSettingsDefaults(row.productType ?? "PHYSICAL")
          .autoXtraPerPallet,
      deliveryTypes: normalizeProductDeliveryTypes(row.deliveryTypes),
      customSections: normalizeProductCustomSections(row.customSections),
    });
    setProductSettingsError(null);
  }

  function closeProductSettings() {
    setEditingProductId(null);
    setProductSettingsDraft(null);
    setProductSettingsError(null);
  }

  async function saveProductSettings() {
    if (!editingProductId || !productSettingsDraft) return;

    const row = rows.find((item) => item.productId === editingProductId);
    if (!row) {
      setProductSettingsError("Could not find a row for this product");
      return;
    }

    try {
      setSavingProductSettings(true);
      setProductSettingsError(null);

      const res = await fetch(
        `/api/products/pricelists/items/${row.id}/full`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...productSettingsDraft,
            allowDemont: false,
            allowPeopleCount: false,
            deliveryTypes: normalizeProductDeliveryTypes(
              productSettingsDraft.deliveryTypes,
            ),
            customSections: normalizeProductCustomSections(
              productSettingsDraft.customSections,
            ),
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setProductSettingsError(
          data.reason ?? "Failed to update product settings",
        );
        return;
      }

      const sharedPatch: Partial<EditableRow> = {
        productType: data.item.productType ?? productSettingsDraft.productType,
        allowDeliveryTypes:
          data.item.allowDeliveryTypes ?? productSettingsDraft.allowDeliveryTypes,
        allowQuantity:
          data.item.allowQuantity ?? productSettingsDraft.allowQuantity,
        allowInstallOptions:
          data.item.allowInstallOptions ??
          productSettingsDraft.allowInstallOptions,
        allowReturnOptions:
          data.item.allowReturnOptions ??
          productSettingsDraft.allowReturnOptions,
        allowExtraServices:
          data.item.allowExtraServices ??
          productSettingsDraft.allowExtraServices,
        allowDemont: false,
        allowPeopleCount: false,
        allowHoursInput:
          data.item.allowHoursInput ?? productSettingsDraft.allowHoursInput,
        allowModelNumber:
          data.item.allowModelNumber ?? productSettingsDraft.allowModelNumber,
        autoXtraPerPallet:
          data.item.autoXtraPerPallet ?? productSettingsDraft.autoXtraPerPallet,
        deliveryTypes:
          data.item.deliveryTypes ?? productSettingsDraft.deliveryTypes,
        customSections:
          data.item.customSections ?? productSettingsDraft.customSections,
      };

      setRows((current) =>
        current.map((item) =>
          item.productId === editingProductId
            ? {
                ...item,
                ...sharedPatch,
              }
            : item,
        ),
      );

      setOriginalRows((current) => {
        const next = { ...current };

        for (const [id, item] of Object.entries(next)) {
          if (item.productId === editingProductId) {
            next[id] = {
              ...item,
              ...sharedPatch,
            };
          }
        }

        return next;
      });

      closeProductSettings();
    } catch {
      setProductSettingsError("Something went wrong while updating settings");
    } finally {
      setSavingProductSettings(false);
    }
  }

  function updateDeliveryType(
    key: ProductDeliveryType["key"],
    patch: Partial<ProductDeliveryType>,
  ) {
    setProductSettingsDraft((current) =>
      current
        ? {
            ...current,
            deliveryTypes: current.deliveryTypes.map((item) =>
              item.key === key
                ? {
                    ...item,
                    ...patch,
                  }
                : item,
            ),
          }
        : current,
    );
  }

  function addCustomSection() {
    setProductSettingsDraft((current) =>
      current
        ? {
            ...current,
                customSections: [
                  ...current.customSections,
                  {
                    id: createDraftId("section"),
                    title: "",
                    usePrices: false,
                    allowMultiple: true,
                    options: [
                      {
                        id: createDraftId("option"),
                        code: "",
                        label: "",
                        price: "0",
                        subcontractorPrice: "0",
                      },
                ],
              },
            ],
          }
        : current,
    );
  }

  function removeCustomSection(sectionId: string) {
    setProductSettingsDraft((current) =>
      current
        ? {
            ...current,
            customSections: current.customSections.filter(
              (section) => section.id !== sectionId,
            ),
          }
        : current,
    );
  }

  function updateCustomSection(
    sectionId: string,
    patch: Partial<ProductCustomSection>,
  ) {
    setProductSettingsDraft((current) =>
      current
        ? {
            ...current,
            customSections: current.customSections.map((section) =>
              section.id === sectionId
                ? {
                    ...section,
                    ...patch,
                  }
                : section,
            ),
          }
        : current,
    );
  }

  function addCustomSectionOption(sectionId: string) {
    setProductSettingsDraft((current) =>
      current
        ? {
            ...current,
            customSections: current.customSections.map((section) =>
              section.id === sectionId
                ? {
                    ...section,
                    options: [
                      ...section.options,
                      {
                        id: createDraftId("option"),
                        code: "",
                        label: "",
                        price: "0",
                        subcontractorPrice: "0",
                      },
                    ],
                  }
                : section,
            ),
          }
        : current,
    );
  }

  function updateCustomSectionOption(
    sectionId: string,
    optionId: string,
    patch: Partial<ProductCustomSection["options"][number]>,
  ) {
    setProductSettingsDraft((current) =>
      current
        ? {
            ...current,
            customSections: current.customSections.map((section) =>
              section.id === sectionId
                ? {
                    ...section,
                    options: section.options.map((option) =>
                      option.id === optionId
                        ? {
                            ...option,
                            ...patch,
                          }
                        : option,
                    ),
                  }
                : section,
            ),
          }
        : current,
    );
  }

  function removeCustomSectionOption(sectionId: string, optionId: string) {
    setProductSettingsDraft((current) =>
      current
        ? {
            ...current,
            customSections: current.customSections.map((section) =>
              section.id === sectionId
                ? {
                    ...section,
                    options: section.options.filter(
                      (option) => option.id !== optionId,
                    ),
                  }
                : section,
            ),
          }
        : current,
    );
  }

  function isDirty(row: EditableRow) {
    const original = originalRows[row.id];
    if (!original) return false;

    const isSpecialRow =
      isReturnRow(row) || isXtraRow(row) || isExtraServiceRow(row);

    return (
      (!isSpecialRow && row.productName !== original.productName) ||
      (!isSpecialRow &&
        (row.productType ?? "PHYSICAL") !==
          (original.productType ?? "PHYSICAL")) ||
      (!isSpecialRow &&
        (row.allowQuantity ?? false) !== (original.allowQuantity ?? false)) ||
      (!isSpecialRow &&
        (row.allowInstallOptions ?? false) !==
          (original.allowInstallOptions ?? false)) ||
      (!isSpecialRow &&
        (row.allowReturnOptions ?? false) !==
          (original.allowReturnOptions ?? false)) ||
      (!isSpecialRow &&
        (row.allowExtraServices ?? false) !==
          (original.allowExtraServices ?? false)) ||
      (!isSpecialRow &&
        (row.allowDemont ?? false) !== (original.allowDemont ?? false)) ||
      (!isSpecialRow &&
        (row.allowPeopleCount ?? false) !==
          (original.allowPeopleCount ?? false)) ||
      (!isSpecialRow &&
        (row.allowHoursInput ?? false) !==
          (original.allowHoursInput ?? false)) ||
      (!isSpecialRow &&
        (row.allowModelNumber ?? false) !==
          (original.allowModelNumber ?? false)) ||
      row.customerPrice !== original.customerPrice ||
      row.subcontractorPrice !== original.subcontractorPrice ||
      row.isActive !== original.isActive ||
      row.optionCode !== original.optionCode ||
      (row.description ?? "") !== (original.description ?? "") ||
      (row.discountAmount ?? "") !== (original.discountAmount ?? "") ||
      (row.discountEndsAt ?? "") !== (original.discountEndsAt ?? "")
    );
  }

  function openPriceListSettings() {
    if (!priceList || !canEditActivePriceListSettings) return;
    setEditingPriceListName(activePriceListSummary?.name ?? priceList.name);
    setPriceListSettingsDraft(normalizePriceListSettings(priceList.settings));
    setEditingPriceListSettings(true);
  }

  function closePriceListSettings() {
    setEditingPriceListSettings(false);
  }

  function updatePriceListChargeSetting(
    key: Exclude<keyof PriceListSettings, "deviations">,
    field: "code" | "description" | "price" | "subcontractorPrice",
    value: string,
  ) {
    setPriceListSettingsDraft((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value,
      },
    }));
  }

  function updatePriceListDeviationSetting(
    code: string,
    field: "price" | "subcontractorPrice",
    value: string,
  ) {
    setPriceListSettingsDraft((current) => {
      const currentSetting =
        current.deviations[code] ??
        createDefaultPriceListSettings().deviations[code];

      if (!currentSetting) {
        return current;
      }

      return {
        ...current,
        deviations: {
          ...current.deviations,
          [code]: {
            ...currentSetting,
            [field]: value,
          },
        },
      };
    });
  }

  async function savePriceListSettings() {
    if (!activePriceListSummary || savingPriceListSettings) return;

    const nextName = editingPriceListName.trim();

    if (canEditActivePriceListName && !nextName) {
      alert("Name is required");
      return;
    }

    try {
      setSavingPriceListSettings(true);

      const res = await fetch(
        `/api/products/pricelists/${activePriceListSummary.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(canEditActivePriceListName ? { name: nextName } : {}),
            settings: normalizePriceListSettings(priceListSettingsDraft),
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.message ?? data.reason ?? "Failed to save pricelist settings");
        return;
      }

      setPriceList((current) =>
        current
          ? {
              ...current,
              name:
                typeof data.priceList.name === "string"
                  ? data.priceList.name
                  : current.name,
              code:
                typeof data.priceList.code === "string"
                  ? data.priceList.code
                  : current.code,
              description:
                typeof data.priceList.description === "string"
                  ? data.priceList.description
                  : current.description,
              settings: normalizePriceListSettings(data.priceList.settings),
            }
          : current,
      );
      setPriceLists((current) =>
        current.map((item) =>
          item.id === data.priceList.id
            ? {
                ...item,
                name:
                  typeof data.priceList.name === "string"
                    ? data.priceList.name
                    : item.name,
                code:
                  typeof data.priceList.code === "string"
                    ? data.priceList.code
                    : item.code,
              }
            : item,
        ),
      );
      setEditingPriceListSettings(false);
    } catch {
      alert("Something went wrong while saving pricelist settings");
    } finally {
      setSavingPriceListSettings(false);
    }
  }

  async function createPriceList() {
    if (!priceList || creatingPriceList) return;

    try {
      setCreatingPriceList(true);

      const res = await fetch("/api/products/pricelists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourcePriceListId: priceList.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.reason ?? "Failed to create pricelist");
        return;
      }

      setPriceLists((current) => [...current, data.priceList]);
      setSelectedPriceListId(data.priceList.id);
    } catch {
      alert("Something went wrong while creating pricelist");
    } finally {
      setCreatingPriceList(false);
    }
  }

  async function saveRow(itemId: string) {
    const row = rows.find((item) => item.id === itemId);
    if (!row) return;

    const isReturn = isReturnRow(row);
    const isXtra = isXtraRow(row);
    const isExtraService = isExtraServiceRow(row);
    const isSpecialRow = isReturn || isXtra || isExtraService;

    const url = isSpecialRow
      ? `/api/products/pricelists/special-options/${itemId}`
      : `/api/products/pricelists/items/${itemId}/full`;

    if (!row.customerPrice.trim()) {
      updateRow(itemId, { error: "Customer price is required" });
      return;
    }

    if (!row.subcontractorPrice.trim()) {
      updateRow(itemId, { error: "Subcontractor price is required" });
      return;
    }

    const customerNumber = Number(row.customerPrice);
    const subcontractorNumber = Number(row.subcontractorPrice);

    if (!Number.isFinite(customerNumber) || customerNumber < 0) {
      updateRow(itemId, { error: "Invalid customer price" });
      return;
    }

    if (!Number.isFinite(subcontractorNumber) || subcontractorNumber < 0) {
      updateRow(itemId, { error: "Invalid subcontractor price" });
      return;
    }

    const body = {
      customerPrice: row.customerPrice,
      subcontractorPrice: row.subcontractorPrice,
      isActive: row.isActive,
      optionCode: row.optionCode,
      description: row.description,
      discountAmount: row.discountAmount,
      discountEndsAt: row.discountEndsAt,
      category: isReturn
        ? "return"
        : isXtra
          ? "xtra"
          : isExtraService
            ? "extra_service"
            : row.category,
      ...(isSpecialRow ? {} : { productName: row.productName }),
      productType: row.productType,
      allowQuantity: row.allowQuantity,
      allowInstallOptions: row.allowInstallOptions,
      allowReturnOptions: row.allowReturnOptions,
      allowExtraServices: row.allowExtraServices,
      allowDemont: row.allowDemont,
      allowPeopleCount: row.allowPeopleCount,
      allowHoursInput: row.allowHoursInput,
      allowModelNumber: row.allowModelNumber,
    };

    try {
      updateRow(itemId, { saving: true, error: null, saved: false });

      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        updateRow(itemId, {
          saving: false,
          saved: false,
          error: data.reason ?? "Failed to update row",
        });
        return;
      }

      const nextItem: EditableRow = isSpecialRow
        ? {
            ...data.item,
            category: isReturn ? "return" : isXtra ? "xtra" : "extra_service",
            optionCode:
              data.item.optionCode ?? data.item.code ?? row.optionCode,
            optionLabel:
              data.item.optionLabel ?? data.item.label ?? row.optionLabel,
            productId: undefined,
            productOptionId: undefined,
            productName: undefined,
            productCode: undefined,
          }
        : {
            ...data.item,
          };

      setRows((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...nextItem,
                saving: false,
                saved: true,
                error: null,
              }
            : item,
        ),
      );

      setOriginalRows((current) => ({
        ...current,
        [itemId]: nextItem,
      }));

      setTimeout(() => {
        setRows((current) =>
          current.map((item) =>
            item.id === itemId ? { ...item, saved: false } : item,
          ),
        );
      }, 1800);
    } catch {
      updateRow(itemId, {
        saving: false,
        saved: false,
        error: "Something went wrong",
      });
    }
  }

  async function addOption(productId: string) {
    if (!priceList) return;

    const res = await fetch(
      `/api/products/pricelists/${priceList.id}/products/${productId}/options`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: "Option",
          optionCode: "",
          category: "install",
          description: "",
        }),
      },
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert("Failed to create option");
      return;
    }

    const newItem = data.item;

    setRows((prev) => [...prev, newItem]);

    setOriginalRows((prev) => ({
      ...prev,
      [newItem.id]: newItem,
    }));
  }

  async function addSpecialOption(
    type: "return" | "xtra" | "extra_service",
    overrides?: {
      code?: string;
      label?: string;
      description?: string;
    },
  ) {
    if (!priceList) return;

    const res = await fetch(
      `/api/products/pricelists/${priceList.id}/special-options`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          code: overrides?.code,
          label: overrides?.label,
          description: overrides?.description,
        }),
      },
    );

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok || !data?.ok) {
      alert(data?.reason ?? `Failed to create ${type} option`);
      return;
    }

    const newItem: EditableRow = {
      ...data.item,
      category:
        data.item.type === "return"
          ? OPTION_CATEGORIES.RETURN
          : data.item.type === "xtra"
            ? OPTION_CATEGORIES.XTRA
            : (data.item.category ?? null),
      productId: undefined,
      productOptionId: undefined,
      productName: undefined,
      productCode: undefined,
      optionLabel: data.item.label ?? null,
    };

    setRows((prev) => [...prev, newItem]);

    setOriginalRows((prev) => ({
      ...prev,
      [newItem.id]: newItem,
    }));
  }

  async function deleteRow(itemId: string) {
    const confirmed = window.confirm("Delete this option?");
    if (!confirmed) return;

    try {
      const item = rows.find((row) => row.id === itemId);
      if (!item) return;

      const isSpecialRow =
        isReturnRow(item) || isXtraRow(item) || isExtraServiceRow(item);

      const url = isSpecialRow
        ? `/api/products/pricelists/special-options/${itemId}`
        : `/api/products/pricelists/items/${itemId}`;

      const res = await fetch(url, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.reason ?? "Failed to delete row");
        return;
      }

      setRows((current) => current.filter((item) => item.id !== itemId));

      setOriginalRows((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    } catch {
      alert("Something went wrong while deleting");
    }
  }

  async function addProduct() {
    if (!priceList) return;

    const res = await fetch(
      `/api/products/pricelists/${priceList.id}/products`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert("Failed to create product");
      return;
    }

    const newItem = data.item;

    setRows((prev) => [...prev, newItem]);

    setOriginalRows((prev) => ({
      ...prev,
      [newItem.id]: newItem,
    }));
  }

  const normalRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          !isReturnRow(row) && !isXtraRow(row) && !isExtraServiceRow(row),
      ),
    [rows],
  );

  const returnRows = useMemo(
    () => rows.filter((row) => isReturnRow(row)),
    [rows],
  );

  const xtraRows = useMemo(() => rows.filter((row) => isXtraRow(row)), [rows]);
  const missingAutomaticXtraKinds = useMemo(() => {
    const presentKinds = new Set<AutomaticXtraKind>(
      xtraRows.map((row) => inferAutomaticXtraKind(row)),
    );

    return (["INDOOR", "FIRST_STEP"] as const).filter(
      (kind) => !presentKinds.has(kind),
    );
  }, [xtraRows]);

  const extraServiceRows = useMemo(
    () => rows.filter((row) => isExtraServiceRow(row)),
    [rows],
  );

  const groupedProducts = useMemo(() => {
    return Object.values(
      normalRows.reduce(
        (acc, item) => {
          if (!item.productId) return acc;

          const key = item.productId;

          if (!acc[key]) {
            acc[key] = {
              productId: item.productId,
              productName: item.productName ?? "",
              productCode: item.productCode ?? "",
              items: [],
            };
          }

          acc[key].items.push(item);
          return acc;
        },
        {} as Record<
          string,
          {
            productId: string;
            productName: string;
            productCode: string;
            items: EditableRow[];
          }
        >,
      ),
    );
  }, [normalRows]);

  const editingProductGroup = useMemo(
    () =>
      editingProductId
        ? groupedProducts.find((group) => group.productId === editingProductId) ??
          null
        : null,
    [editingProductId, groupedProducts],
  );

  const hasAutomaticXtra = missingAutomaticXtraKinds.length === 0;

  if (loading) {
    return (
      <main className="w-full">
        <div className="mx-auto max-w-[1800] p-6 text-center">Loading...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-full">
        <div className="mx-auto max-w-[1800] p-6 text-center text-red-600">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="w-full">
      <div className="mx-auto max-w-[1800]">
        <div className="mb-20">
          <h1 className="text-2xl font-bold text-center text-logoblue">
            Edit Prices
          </h1>
        </div>

        <div id="activeTab" className="w-full">
          <div className="max-w-[900] mx-auto flex justify-center items-center gap-3 mb-6 flex-wrap">
            {priceLists.map((item) => {
              const isActive = activePriceListSummary?.id === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedPriceListId(item.id)}
                  className={`customButtonDefault ${
                    isActive
                      ? "bg-logoblue text-white!"
                      : "bg-white text-logoblue"
                  }`}
                >
                  {item.name}
                </button>
              );
            })}

            <button
              type="button"
              onClick={createPriceList}
              disabled={!priceList || creatingPriceList}
              className="customButtonDefault px-2.5!"
              title="Add pricelist"
            >
              {creatingPriceList ? "…" : "+"}
            </button>
            {activePriceListSummary && (
              <div className="flex justify-center items-center gap-2 flex-wrap">
                {canEditActivePriceListSettings && (
                  <button
                    type="button"
                    onClick={openPriceListSettings}
                    disabled={!priceList}
                    className="customButtonDefault"
                  >
                    Pricelist settings
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:pl-[50] lg:pr-[200] space-y-12">
          <section>
            <div className="mb-4 flex flex-col items-start gap-3">
              <h2 className="text-xl font-bold text-logoblue">
                Product Options
              </h2>
              <button
                type="button"
                onClick={addProduct}
                className="customButtonEnabled"
              >
                Add Product
              </button>
            </div>

            <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              <table className="w-full table-fixed border border-black/10">
                <thead className="bg-gray-100">
                  <tr className="text-left">
                    <th className="w-64 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Product
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Option Code
                    </th>
                    <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Description
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Category
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Customer Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Subcontractor Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount time
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Active
                    </th>
                    <th className="w-40 px-4 py-4 border-l border-black/10 bg-white text-logoBlue font-semibold text-center">
                      Update
                    </th>
                  </tr>
                </thead>

                {groupedProducts.map((group) => (
                  <tbody key={group.productId} className="group">
                    {group.items.map((item, index) => {
                      const discountActive =
                        item.discountAmount &&
                        item.discountEndsAt &&
                        new Date(item.discountEndsAt) > new Date();

                      return (
                        <tr
                          key={item.id}
                          className="group relative align-middle [&>td:not(:last-child)]:border-b-2 [&>td:not(:last-child)]:border-logoblue/50"
                        >
                          {index === 0 && (
                            <td
                              rowSpan={group.items.length}
                              className="border-r border-logoblue/50 font-medium align-center relative before:content-[''] before:absolute before:top-0 before:bottom-0 before:left-[-100] before:w-[200] before:bg-transparent"
                            >
                              <div className="flex flex-col gap-3 p-3">
                                <input
                                  className="w-full text-center py-1 px-2 rounded focus:outline-none hover:bg-black/5"
                                  value={group.productName}
                                  onChange={(e) =>
                                    updateProductRows(group.productId, {
                                      productName: e.target.value,
                                    })
                                  }
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    openProductSettings(group.productId)
                                  }
                                  className="customButtonDefault text-xs"
                                >
                                  Edit settings
                                </button>

                                <button
                                  type="button"
                                  title="Add option"
                                  onClick={() => addOption(group.productId)}
                                  className="absolute -left-11 top-1/2 -translate-y-1/2 w-6 h-6 text-sm rounded-full bg-white border-2 border-logoblue font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:text-white hover:bg-logoblue cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          )}

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.optionCode ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  optionCode: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ""),
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <div className="flex items-center justify-center">
                              <p>Install</p>
                            </div>
                          </td>

                          <td>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none text-center"
                                value={item.customerPrice ?? ""}
                                onChange={(e) =>
                                  updateRow(item.id, {
                                    customerPrice: e.target.value,
                                  })
                                }
                              />
                              {discountActive && (
                                <div className="text-sm mt-1 flex gap-2 items-center">
                                  <span className="text-red-600 font-semibold">
                                    {item.effectiveCustomerPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.subcontractorPrice ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  subcontractorPrice: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountAmount ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountAmount: e.target.value,
                                })
                              }
                              placeholder='"%" or number'
                            />
                          </td>

                          <td>
                            <input
                              type="date"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountEndsAt ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountEndsAt: e.target.value || null,
                                })
                              }
                            />
                          </td>

                          <td>
                            <select
                              className="w-full py-2 px-2 hover:bg-black/2"
                              value={item.isActive ? "active" : "disabled"}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  isActive: e.target.value === "active",
                                })
                              }
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </td>

                          <td className="align-middle border-l border-logoblue/20">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-2 relative">
                                {isDirty(item) && (
                                  <button
                                    type="button"
                                    onClick={() => saveRow(item.id)}
                                    disabled={item.saving}
                                    className="customButtonEnabled"
                                  >
                                    {item.saving ? "Saving..." : "Update"}
                                  </button>
                                )}

                                {!isDirty(item) && item.saved && (
                                  <span className="text-sm text-green-600 font-medium">
                                    Saved
                                  </span>
                                )}

                                {!isDirty(item) && item.error && (
                                  <span className="text-sm text-red-600 font-medium">
                                    {item.error}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => deleteRow(item.id)}
                                  className="px-3 py-1 rounded-md border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex flex-col items-start gap-3">
              <h2 className="text-xl font-bold text-logoblue">
                Return Options
              </h2>
              <button
                type="button"
                onClick={() => addSpecialOption("return")}
                className="customButtonEnabled"
              >
                Add Option
              </button>
            </div>

            <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              <table className="w-full table-fixed border border-black/10">
                <thead className="bg-gray-100">
                  <tr className="text-left">
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Option Code
                    </th>
                    <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Description
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Category
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Customer Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Subcontractor Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount time
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Active
                    </th>
                    <th className="w-40 px-4 py-4 border-l border-black/10 bg-white text-logoBlue font-semibold text-center">
                      Update
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {returnRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-black/50"
                      >
                        No return options found.
                      </td>
                    </tr>
                  ) : (
                    returnRows.map((item) => {
                      const discountActive =
                        item.discountAmount &&
                        item.discountEndsAt &&
                        new Date(item.discountEndsAt) > new Date();

                      return (
                        <tr
                          key={item.id}
                          className="group relative align-middle [&>td:not(:last-child)]:border-b [&>td:not(:last-child)]:border-logoblue/20"
                        >
                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.optionCode ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  optionCode: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ""),
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <div className="flex items-center justify-center">
                              <p>{OPTION_CATEGORIES.RETURN}</p>
                            </div>
                          </td>

                          <td>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none text-center"
                                value={item.customerPrice ?? ""}
                                onChange={(e) =>
                                  updateRow(item.id, {
                                    customerPrice: e.target.value,
                                  })
                                }
                              />
                              {discountActive && (
                                <div className="text-sm mt-1 flex gap-2 items-center">
                                  <span className="text-red-600 font-semibold">
                                    {item.effectiveCustomerPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.subcontractorPrice ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  subcontractorPrice: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountAmount ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountAmount: e.target.value,
                                })
                              }
                              placeholder='"%" or number'
                            />
                          </td>

                          <td>
                            <input
                              type="date"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountEndsAt ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountEndsAt: e.target.value || null,
                                })
                              }
                            />
                          </td>

                          <td>
                            <select
                              className="w-full py-2 px-2 hover:bg-black/2"
                              value={item.isActive ? "active" : "disabled"}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  isActive: e.target.value === "active",
                                })
                              }
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </td>

                          <td className="align-middle border-l border-logoblue/20">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-2 relative">
                                {isDirty(item) && (
                                  <button
                                    type="button"
                                    onClick={() => saveRow(item.id)}
                                    disabled={item.saving}
                                    className="customButtonEnabled"
                                  >
                                    {item.saving ? "Saving..." : "Update"}
                                  </button>
                                )}

                                {!isDirty(item) && item.saved && (
                                  <span className="text-sm text-green-600 font-medium">
                                    Saved
                                  </span>
                                )}

                                {!isDirty(item) && item.error && (
                                  <span className="text-sm text-red-600 font-medium">
                                    {item.error}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => deleteRow(item.id)}
                                  className="px-3 py-1 rounded-md border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex flex-col items-start gap-3">
              <h2 className="text-xl font-bold text-logoblue">
                Utpakking / Demontering
              </h2>
              <button
                type="button"
                onClick={() => addSpecialOption("extra_service")}
                className="customButtonEnabled"
              >
                Add Option
              </button>
            </div>

            <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              <table className="w-full table-fixed border border-black/10">
                <thead className="bg-gray-100">
                  <tr className="text-left">
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Option Code
                    </th>
                    <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Description
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Category
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Customer Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Subcontractor Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount time
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Active
                    </th>
                    <th className="w-40 px-4 py-4 border-l border-black/10 bg-white text-logoBlue font-semibold text-center">
                      Update
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {extraServiceRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-black/50"
                      >
                        No utpakking / demontering options found.
                      </td>
                    </tr>
                  ) : (
                    extraServiceRows.map((item) => {
                      const discountActive =
                        item.discountAmount &&
                        item.discountEndsAt &&
                        new Date(item.discountEndsAt) > new Date();

                      return (
                        <tr
                          key={item.id}
                          className="group relative align-middle [&>td:not(:last-child)]:border-b [&>td:not(:last-child)]:border-logoblue/20"
                        >
                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.optionCode ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  optionCode: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ""),
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <div className="flex items-center justify-center">
                              <p>Extra service</p>
                            </div>
                          </td>

                          <td>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none text-center"
                                value={item.customerPrice ?? ""}
                                onChange={(e) =>
                                  updateRow(item.id, {
                                    customerPrice: e.target.value,
                                  })
                                }
                              />
                              {discountActive && (
                                <div className="text-sm mt-1 flex gap-2 items-center">
                                  <span className="text-red-600 font-semibold">
                                    {item.effectiveCustomerPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.subcontractorPrice ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  subcontractorPrice: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountAmount ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountAmount: e.target.value,
                                })
                              }
                              placeholder='"%" or number'
                            />
                          </td>

                          <td>
                            <input
                              type="date"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountEndsAt ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountEndsAt: e.target.value || null,
                                })
                              }
                            />
                          </td>

                          <td>
                            <select
                              className="w-full py-2 px-2 hover:bg-black/2"
                              value={item.isActive ? "active" : "disabled"}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  isActive: e.target.value === "active",
                                })
                              }
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </td>

                          <td className="align-middle border-l border-logoblue/20">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-2 relative">
                                {isDirty(item) && (
                                  <button
                                    type="button"
                                    onClick={() => saveRow(item.id)}
                                    disabled={item.saving}
                                    className="customButtonEnabled"
                                  >
                                    {item.saving ? "Saving..." : "Update"}
                                  </button>
                                )}

                                {!isDirty(item) && item.saved && (
                                  <span className="text-sm text-green-600 font-medium">
                                    Saved
                                  </span>
                                )}

                                {!isDirty(item) && item.error && (
                                  <span className="text-sm text-red-600 font-medium">
                                    {item.error}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => deleteRow(item.id)}
                                  className="px-3 py-1 rounded-md border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex flex-col items-start gap-3">
              <h2 className="text-xl font-bold text-logoblue">
                Automatic XTRA
              </h2>
              {!hasAutomaticXtra && (
                <button
                  type="button"
                  onClick={() => {
                    const nextKind = missingAutomaticXtraKinds[0];
                    if (!nextKind) return;

                    void addSpecialOption(
                      "xtra",
                      buildAutomaticXtraDraft(nextKind),
                    );
                  }}
                  className="customButtonEnabled"
                >
                  {missingAutomaticXtraKinds[0] === "FIRST_STEP"
                    ? "Add Automatic XTRA for Delivery"
                    : "Add Automatic XTRA for Innbæring"}
                </button>
              )}
            </div>

            <div className="w-full overflow-x-auto lg:overflow-x-visible [-webkit-overflow-scrolling:touch]">
              <table className="w-full table-fixed border border-black/10">
                <thead className="bg-gray-100">
                  <tr className="text-left">
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Option Code
                    </th>
                    <th className="w-60 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Description
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Category
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Customer Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Subcontractor Price
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Discount time
                    </th>
                    <th className="w-30 px-4 py-4 border bg-logoblue text-white font-semibold text-center">
                      Active
                    </th>
                    <th className="w-40 px-4 py-4 border-l border-black/10 bg-white text-logoBlue font-semibold text-center">
                      Update
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {xtraRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-black/50"
                      >
                        No automatic XTRA option found.
                      </td>
                    </tr>
                  ) : (
                    xtraRows.map((item) => {
                      const discountActive =
                        item.discountAmount &&
                        item.discountEndsAt &&
                        new Date(item.discountEndsAt) > new Date();

                      return (
                        <tr
                          key={item.id}
                          className="group relative align-middle [&>td:not(:last-child)]:border-b [&>td:not(:last-child)]:border-logoblue/20"
                        >
                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.optionCode ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  optionCode: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ""),
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <div className="flex items-center justify-center">
                              <p>{OPTION_CODES.XTRA}</p>
                            </div>
                          </td>

                          <td>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none text-center"
                                value={item.customerPrice ?? ""}
                                onChange={(e) =>
                                  updateRow(item.id, {
                                    customerPrice: e.target.value,
                                  })
                                }
                              />
                              {discountActive && (
                                <div className="text-sm mt-1 flex gap-2 items-center">
                                  <span className="text-red-600 font-semibold">
                                    {item.effectiveCustomerPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.subcontractorPrice ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  subcontractorPrice: e.target.value,
                                })
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountAmount ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountAmount: e.target.value,
                                })
                              }
                              placeholder='"%" or number'
                            />
                          </td>

                          <td>
                            <input
                              type="date"
                              className="w-full py-2 px-2 hover:bg-black/2 focus:outline-none"
                              value={item.discountEndsAt ?? ""}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  discountEndsAt: e.target.value || null,
                                })
                              }
                            />
                          </td>

                          <td>
                            <select
                              className="w-full py-2 px-2 hover:bg-black/2"
                              value={item.isActive ? "active" : "disabled"}
                              onChange={(e) =>
                                updateRow(item.id, {
                                  isActive: e.target.value === "active",
                                })
                              }
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </td>

                          <td className="align-middle border-l border-logoblue/20">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-2 relative">
                                {isDirty(item) && (
                                  <button
                                    type="button"
                                    onClick={() => saveRow(item.id)}
                                    disabled={item.saving}
                                    className="customButtonEnabled"
                                  >
                                    {item.saving ? "Saving..." : "Update"}
                                  </button>
                                )}

                                {!isDirty(item) && item.saved && (
                                  <span className="text-sm text-green-600 font-medium">
                                    Saved
                                  </span>
                                )}

                                {!isDirty(item) && item.error && (
                                  <span className="text-sm text-red-600 font-medium">
                                    {item.error}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center"></div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {editingPriceListSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 shrink-0">
              <h2 className="text-lg font-bold text-logoblue">
                Pricelist settings
              </h2>
            </div>

            <div className="space-y-4 overflow-y-auto pr-2">
              <div className="space-y-3 rounded-lg border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-logoblue">
                  Pricelist
                </h3>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Name
                  </span>
                  <input
                    type="text"
                    value={editingPriceListName}
                    onChange={(e) => setEditingPriceListName(e.target.value)}
                    disabled={!canEditActivePriceListName}
                    className="customInput w-full disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Pricelist name"
                  />
                </label>

                {!canEditActivePriceListName && (
                  <p className="text-sm text-black/60">
                    Default pricelist name cannot be changed.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-logoblue">
                  Extra pickup location
                </h3>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Code
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.extraPickup.code}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "extraPickup",
                        "code",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Code"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Description
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.extraPickup.description}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "extraPickup",
                        "description",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Description"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.extraPickup.price}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "extraPickup",
                        "price",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Price"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Subcontractor price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.extraPickup.subcontractorPrice}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "extraPickup",
                        "subcontractorPrice",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Subcontractor price"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-logoblue">
                  Express delivery
                </h3>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Code
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.expressDelivery.code}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "expressDelivery",
                        "code",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Code"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Description
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.expressDelivery.description}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "expressDelivery",
                        "description",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Description"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.expressDelivery.price}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "expressDelivery",
                        "price",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Price"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Subcontractor price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={
                      priceListSettingsDraft.expressDelivery.subcontractorPrice
                    }
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "expressDelivery",
                        "subcontractorPrice",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Subcontractor price"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-logoblue">
                  XTRA pallet
                </h3>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Code
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.xtraPallet.code}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "xtraPallet",
                        "code",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Code"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Description
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.xtraPallet.description}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "xtraPallet",
                        "description",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Description"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.xtraPallet.price}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "xtraPallet",
                        "price",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Price"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Subcontractor price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.xtraPallet.subcontractorPrice}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "xtraPallet",
                        "subcontractorPrice",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Subcontractor price"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-logoblue">
                  KM from 21 km
                </h3>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Code
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.kmFrom21.code}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmFrom21",
                        "code",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Code"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Description
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.kmFrom21.description}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmFrom21",
                        "description",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Description"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.kmFrom21.price}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmFrom21",
                        "price",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Price per km"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Subcontractor price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.kmFrom21.subcontractorPrice}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmFrom21",
                        "subcontractorPrice",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Subcontractor price per km"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-logoblue">
                  KM over 100 km
                </h3>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Code
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.kmOver100.code}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmOver100",
                        "code",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Code"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Description
                  </span>
                  <input
                    type="text"
                    value={priceListSettingsDraft.kmOver100.description}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmOver100",
                        "description",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Description"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.kmOver100.price}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmOver100",
                        "price",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Price per km"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-black/80">
                    Subcontractor price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={priceListSettingsDraft.kmOver100.subcontractorPrice}
                    onChange={(e) =>
                      updatePriceListChargeSetting(
                        "kmOver100",
                        "subcontractorPrice",
                        e.target.value,
                      )
                    }
                    className="customInput w-full"
                    placeholder="Subcontractor price per km"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-black/10 p-4">
                <h3 className="text-sm font-semibold text-logoblue">
                  Bomtur / deviation prices
                </h3>

                <div className="space-y-3">
                  {DEVIATION_FEE_OPTIONS.map((option) => {
                    const setting =
                      priceListSettingsDraft.deviations[option.code] ??
                      createDefaultPriceListSettings().deviations[option.code];

                    return (
                      <div
                        key={option.code}
                        className="rounded-md border border-black/10 p-3"
                      >
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-black/80">
                            {option.code}
                          </p>
                          <p className="text-xs text-black/60">
                            {option.englishLabel}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-black/80">
                              Price
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={setting?.price ?? String(option.price)}
                              onChange={(e) =>
                                updatePriceListDeviationSetting(
                                  option.code,
                                  "price",
                                  e.target.value,
                                )
                              }
                              className="customInput w-full"
                              placeholder="Price"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-black/80">
                              Subcontractor price
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={
                                setting?.subcontractorPrice ??
                                String(option.subcontractorPrice)
                              }
                              onChange={(e) =>
                                updatePriceListDeviationSetting(
                                  option.code,
                                  "subcontractorPrice",
                                  e.target.value,
                                )
                              }
                              className="customInput w-full"
                              placeholder="Subcontractor price"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-sm text-black/60">
                Product delivery type prices are edited per product.
              </p>
            </div>

            <div className="mt-6 flex shrink-0 justify-end gap-2 border-t border-black/10 pt-4">
              <button
                type="button"
                onClick={closePriceListSettings}
                disabled={savingPriceListSettings}
                className="customButtonDefault"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePriceListSettings}
                disabled={savingPriceListSettings}
                className="customButtonEnabled"
              >
                {savingPriceListSettings ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProductGroup && productSettingsDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 shrink-0">
              <h2 className="text-lg font-bold text-logoblue">
                Edit - {editingProductGroup.productName || "Unnamed product"}
              </h2>
            </div>

            <div className="space-y-4 overflow-y-auto pr-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-black/80">
                  Product type
                </span>
                <select
                  value={productSettingsDraft.productType}
                  onChange={(e) =>
                    setProductSettingsDraft(
                      buildProductSettingsDefaults(
                        e.target.value as "PHYSICAL" | "PALLET" | "LABOR",
                      ),
                    )
                  }
                  className="customInput w-full"
                >
                  <option value="PHYSICAL">Physical</option>
                  <option value="PALLET">Pallet</option>
                  <option value="LABOR">Labor</option>
                </select>
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRODUCT_SETTING_FIELDS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 customContainer"
                  >
                    <input
                      type="checkbox"
                      checked={productSettingsDraft[key]}
                      onChange={(e) =>
                        setProductSettingsDraft((current) =>
                          current
                            ? {
                                ...current,
                                [key]: e.target.checked,
                              }
                            : current,
                        )
                      }
                      className="background h-4 w-4"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>

              {productSettingsDraft.allowDeliveryTypes && (
                <details className="customContainer p-3" open>
                  <summary className="cursor-pointer text-sm font-semibold text-black/80">
                    Delivery types
                  </summary>

                  <div className="mt-3 space-y-3">
                    {productSettingsDraft.deliveryTypes.map((deliveryType) => (
                      <div key={deliveryType.key} className="customContainer p-3">
                        <div className="mb-3 text-sm font-semibold text-black/80">
                          {getDeliveryTypeEditorTitle(deliveryType.key)}
                        </div>

                        <div
                          className={
                            supportsXtraPrice(deliveryType.key)
                              ? "grid grid-cols-1 gap-2 sm:grid-cols-6"
                              : "grid grid-cols-1 gap-2 sm:grid-cols-4"
                          }
                        >
                          <input
                            type="text"
                            value={deliveryType.code}
                            onChange={(e) =>
                              updateDeliveryType(deliveryType.key, {
                                code: e.target.value,
                              })
                            }
                            className="customInput w-full"
                            placeholder="Code"
                          />
                          <input
                            type="text"
                            value={deliveryType.label}
                            onChange={(e) =>
                              updateDeliveryType(deliveryType.key, {
                                label: e.target.value,
                              })
                            }
                            className="customInput w-full"
                            placeholder="Name"
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={deliveryType.price}
                            onChange={(e) =>
                              updateDeliveryType(deliveryType.key, {
                                price: e.target.value,
                              })
                            }
                            className="customInput w-full"
                            placeholder={getDeliveryTypePricePlaceholder(
                              deliveryType.key,
                            )}
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={deliveryType.subcontractorPrice}
                            onChange={(e) =>
                              updateDeliveryType(deliveryType.key, {
                                subcontractorPrice: e.target.value,
                              })
                            }
                            className="customInput w-full"
                            placeholder="Subcontractor price"
                          />
                          {supportsXtraPrice(deliveryType.key) && (
                            <>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={deliveryType.xtraPrice}
                                onChange={(e) =>
                                  updateDeliveryType(deliveryType.key, {
                                    xtraPrice: e.target.value,
                                  })
                                }
                                className="customInput w-full"
                                placeholder={getDeliveryTypeXtraPlaceholder(
                                  deliveryType.key,
                                )}
                              />
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={deliveryType.xtraSubcontractorPrice}
                                onChange={(e) =>
                                  updateDeliveryType(deliveryType.key, {
                                    xtraSubcontractorPrice: e.target.value,
                                  })
                                }
                                className="customInput w-full"
                                placeholder="XTRA subcontractor price"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-black/80">
                      Custom sections
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomSection}
                    className="customButtonDefault text-xs"
                  >
                    Add custom section
                  </button>
                </div>

                {productSettingsDraft.customSections.length === 0 ? (
                  <div className="customContainer text-sm text-black/50">
                    No custom sections added.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productSettingsDraft.customSections.map((section) => (
                      <div key={section.id} className="customContainer p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-black/80">
                            Custom section
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeCustomSection(section.id)}
                            className="customButtonDefault text-xs"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="space-y-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-black/70">
                              Title
                            </span>
                            <input
                              type="text"
                              value={section.title}
                              onChange={(e) =>
                                updateCustomSection(section.id, {
                                  title: e.target.value,
                                })
                              }
                              className="customInput w-full"
                              placeholder="Example: Wall type"
                            />
                          </label>

                          <label className="flex items-center gap-2 customContainer">
                            <input
                              type="checkbox"
                              checked={section.usePrices}
                              onChange={(e) =>
                                updateCustomSection(section.id, {
                                  usePrices: e.target.checked,
                                })
                              }
                              className="customInput h-4 w-4"
                            />
                            <span className="text-sm">Use prices</span>
                          </label>

                          <label className="flex items-center gap-2 customContainer">
                            <input
                              type="checkbox"
                              checked={section.allowMultiple}
                              onChange={(e) =>
                                updateCustomSection(section.id, {
                                  allowMultiple: e.target.checked,
                                })
                              }
                              className="customInput h-4 w-4"
                            />
                            <span className="text-sm">Allow multiple selections</span>
                          </label>

                          <div className="space-y-2">
                            {section.options.map((option) => (
                              <div
                                key={option.id}
                                className={
                                  section.usePrices
                                    ? "grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_110px_110px_auto]"
                                    : "grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]"
                                }
                              >
                                <input
                                  type="text"
                                  value={option.code}
                                  onChange={(e) =>
                                    updateCustomSectionOption(
                                      section.id,
                                      option.id,
                                      {
                                        code: e.target.value,
                                      },
                                    )
                                  }
                                  className="customInput w-full"
                                  placeholder="Code (optional)"
                                />
                                <input
                                  type="text"
                                  value={option.label}
                                  onChange={(e) =>
                                    updateCustomSectionOption(
                                      section.id,
                                      option.id,
                                      {
                                        label: e.target.value,
                                      },
                                    )
                                  }
                                  className="customInput w-full"
                                  placeholder="Option label"
                                />
                                {section.usePrices && (
                                  <>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={option.price}
                                      onChange={(e) =>
                                        updateCustomSectionOption(
                                          section.id,
                                          option.id,
                                          {
                                            price: e.target.value,
                                          },
                                        )
                                      }
                                      className="customInput w-full"
                                      placeholder="Price"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={option.subcontractorPrice}
                                      onChange={(e) =>
                                        updateCustomSectionOption(
                                          section.id,
                                          option.id,
                                          {
                                            subcontractorPrice: e.target.value,
                                          },
                                        )
                                      }
                                      className="customInput w-full"
                                      placeholder="Sub price"
                                    />
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeCustomSectionOption(
                                      section.id,
                                      option.id,
                                    )
                                  }
                                  className="customButtonDefault text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => addCustomSectionOption(section.id)}
                            className="customButtonDefault text-xs"
                          >
                            Add option
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {productSettingsError && (
                <p className="text-sm text-red-600">{productSettingsError}</p>
              )}
            </div>

            <div className="mt-6 flex shrink-0 justify-end gap-2 border-t border-black/10 pt-4">
              <button
                type="button"
                onClick={closeProductSettings}
                disabled={savingProductSettings}
                className="customButtonDefault"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProductSettings}
                disabled={savingProductSettings}
                className="customButtonEnabled"
              >
                {savingProductSettings ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
