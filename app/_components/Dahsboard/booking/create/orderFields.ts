export const OrderFields = {
  Products: 1 << 0,
  AddProductButton: 1 << 1,
  PickupLocations: 1 << 2,
  Calculator: 1 << 3,
  OrderNumber: 1 << 4,
  Description: 1 << 5,
  ModelNr: 1 << 6,
  DeliveryDate: 1 << 7,
  DeliveryTimeWindow: 1 << 8,
  DeliveryAddress: 1 << 9,
  DrivingDistance: 1 << 10,
  CustomerName: 1 << 11,
  CustomerPhone1: 1 << 12,
  CustomerPhone2: 1 << 13,
  CustomerEmail: 1 << 14,
  CustomerComments: 1 << 15,
  FloorNo: 1 << 16,
  Lift: 1 << 17,
  CashierName: 1 << 18,
  CashierPhone: 1 << 19,
  Subcontractor: 1 << 20,
  Driver1: 1 << 21,
  Driver2: 1 << 22,
  DriverInfo: 1 << 23,
  LicensePlate: 1 << 24,
  Deviation: 1 << 25,
  FeeExtraWork: 1 << 26,
  FeeAddToOrder: 1 << 27,
  StatusNotes: 1 << 28,
  ChangeCustomer: 1 << 29,
  Status: 1 << 30,
  Attachment: 1 << 31,
} as const;

export type HiddenMask = number;

export function shown(hiddenMask: HiddenMask, flag: number) {
  return (hiddenMask & flag) === 0;
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
