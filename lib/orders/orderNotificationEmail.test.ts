import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { buildOrderItemsFromCards } from "./buildOrderItemsFromCards";

const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: sendEmailMock,
}));

import { sendOrderNotificationEmail } from "./orderNotificationEmail";

const product: CatalogProduct = {
  id: "product-1",
  code: "PROD-1",
  label: "Seng",
  active: true,
  productType: "PHYSICAL",
  allowDeliveryTypes: false,
  allowInstallOptions: false,
  allowReturnOptions: false,
  allowExtraServices: false,
  allowDemont: false,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: false,
  autoXtraPerPallet: false,
  deliveryTypes: [],
  options: [],
  customSections: [
    {
      id: "section-free",
      title: "Etasje",
      usePrices: false,
      allowMultiple: false,
      allowDeselect: true,
      useAsReturnOptions: false,
      displayOnDeliveryTypes: [DELIVERY_TYPES.INSTALL_ONLY],
      options: [{ id: "floor-3", code: "ETG3", label: "3. etasje", price: "0" }],
    },
  ],
};

const card: SavedProductCard = {
  cardId: 0,
  productId: "product-1",
  modelNumber: "",
  deliveryType: "",
  amount: 1,
  peopleCount: 1,
  hoursInput: 1,
  selectedInstallOptionIds: [],
  selectedExtraOptionIds: [],
  selectedReturnOptionId: null,
  demontEnabled: false,
  selectedTimeOptionIds: [],
  extraTimeHours: 0.5,
  extraPalletEnabled: false,
  extraPalletQty: 1,
  etterEnabled: false,
  etterQty: 1,
  customSectionSelections: [{ sectionId: "section-free", optionIds: ["floor-3"] }],
};

describe("sendOrderNotificationEmail", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it("lists free custom section selections in the order email", async () => {
    await sendOrderNotificationEmail({
      kind: "created",
      order: { id: "order-1", displayId: 1 },
      items: buildOrderItemsFromCards([card], [product], []),
    });

    const html = sendEmailMock.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain("Seng");
    expect(html).toContain("Etasje: 3. etasje (ETG3)");
  });
});
