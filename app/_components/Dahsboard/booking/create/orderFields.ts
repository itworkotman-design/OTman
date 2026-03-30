export type OrderFieldValue = (typeof OrderFields)[keyof typeof OrderFields];

export const OrderFields = {
  Products: 1 << 0,
  AddProductButton: 1 << 1,
  OrderNumber: 1 << 2,
  Description: 1 << 3,
  ModelNr: 1 << 4,
  DeliveryDate: 1 << 5,
  DeliveryTimeWindow: 1 << 6,
  PickupLocations: 1 << 7,
  DeliveryAddress: 1 << 8,
  DrivingDistance: 1 << 9,
  CustomerName: 1 << 10,
  CustomerPhone1: 1 << 11,
  CustomerPhone2: 1 << 12,
  CustomerEmail: 1 << 13,
  CustomerComments: 1 << 14,
  FloorNo: 1 << 15,
  Lift: 1 << 16,
  CashierName: 1 << 17,
  CashierPhone: 1 << 18,
  Subcontractor: 1 << 19,
  Driver1: 1 << 20,
  Driver2: 1 << 21,
  DriverInfo: 1 << 22,
  LicensePlate: 1 << 23,
  Deviation: 1 << 24,
  FeeExtraWork: 1 << 25,
  FeeAddToOrder: 1 << 26,
  StatusNotes: 1 << 27,
  ChangeCustomer: 1 << 28,
  Status: 1 << 29,
  Attachment: 1 << 30,
} as const;

export type HiddenMask = number;

export function shown(hidden: HiddenMask, field: number) {
  return (hidden & field) === 0;
}

export const OrderPresets = {
  CashierView:
    OrderFields.Driver1 |
    OrderFields.Driver2 |
    OrderFields.DriverInfo |
    OrderFields.LicensePlate |
    OrderFields.Subcontractor |
    OrderFields.Deviation,

  DriverView:
    OrderFields.CashierName |
    OrderFields.CashierPhone |
    OrderFields.ChangeCustomer |
    OrderFields.FeeExtraWork |
    OrderFields.FeeAddToOrder,

  Power:
    OrderFields.OrderNumber |
    OrderFields.DrivingDistance |
    OrderFields.CustomerPhone2 |
    OrderFields.CustomerComments |
    OrderFields.FloorNo |
    OrderFields.Lift |
    OrderFields.CashierName |
    OrderFields.CashierPhone |
    OrderFields.Subcontractor |
    OrderFields.Driver1 |
    OrderFields.Driver2 |
    OrderFields.DriverInfo |
    OrderFields.LicensePlate |
    OrderFields.Deviation |
    OrderFields.FeeExtraWork |
    OrderFields.FeeAddToOrder |
    OrderFields.StatusNotes |
    OrderFields.ChangeCustomer |
    OrderFields.Status |
    OrderFields.Attachment,
} as const;
