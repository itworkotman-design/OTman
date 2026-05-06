"use client";

import React from "react";
import { OrderFields, shown, type HiddenMask } from "@/app/_components/Dahsboard/booking/create/orderFields";
import { PickupLocations } from "@/app/_components/Dahsboard/booking/create/PickupLocations";
import { UserOption } from "@/lib/users/types";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import OrderAttachmentsSection from "@/app/_components/Dahsboard/booking/create/OrderAttachmentsSection";
import { type AttachmentCategory, type AttachmentItem } from "@/lib/orders/attachmentCategories";
import { DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";
import {
  bookingStatusText,
  bookingText,
  type BookingUiLocale,
} from "@/lib/booking/bookingUiText";

const CUSTOM_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

const MIN_CUSTOM_TIME_GAP_MINUTES = 120;


function parseCustomTimeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function FormSectionSpacer() {
  return (
    <div className="py-8">
      <div className="h-px w-full bg-logoblue" />
    </div>
  );
}

function FieldErrorMessage({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>;
}

type Props = {
  locale?: BookingUiLocale;
  hidden: HiddenMask;
  hideDontSendEmail: boolean;
  allowPastDeliveryDates: boolean;
  isInstallationOnly: boolean;
  isReturnOnly: boolean;
  shouldLockPickupAddress: boolean;
  hideSubmitButton: boolean;
  subcontractorLoading: boolean;
  subcontractorOptions: UserOption[];
  changeCustomerLoading: boolean;
  changeCustomerOptions: UserOption[];
  saving: boolean;
  submitError: string;
  deliveryDateError: string | null;
  deliveryDateWarning: string | null;
  timeWindowError: string | null;
  pickupAddressError: string | null;
  deliveryAddressError: string | null;
  returnAddressError: string | null;

  orderNumber: string;
  setOrderNumber: React.Dispatch<React.SetStateAction<string>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  modelNr: string;
  setModelNr: React.Dispatch<React.SetStateAction<string>>;
  deliveryDate: string;
  setDeliveryDate: React.Dispatch<React.SetStateAction<string>>;
  timeWindow: string;
  setTimeWindow: React.Dispatch<React.SetStateAction<string>>;
  expressDelivery: boolean;
  setExpressDelivery: React.Dispatch<React.SetStateAction<boolean>>;
  customTimeFrom: string;
  setCustomTimeFrom: React.Dispatch<React.SetStateAction<string>>;
  customTimeTo: string;
  setCustomTimeTo: React.Dispatch<React.SetStateAction<string>>;
  contactCustomerForCustomTimeWindow: boolean;
  setContactCustomerForCustomTimeWindow: React.Dispatch<React.SetStateAction<boolean>>;
  customTimeContactNote: string;
  setCustomTimeContactNote: React.Dispatch<React.SetStateAction<string>>;
  deliveryAddress: string;
  setDeliveryAddress: React.Dispatch<React.SetStateAction<string>>;
  drivingDistance: string;
  setDrivingDistance: React.Dispatch<React.SetStateAction<string>>;
  pickupAddress: string;
  setPickupAddress: React.Dispatch<React.SetStateAction<string>>;
  extraPickups: {
    id: string;
    address: string;
    phone: string;
    email: string;
    sendEmail: boolean;
  }[];
  setExtraPickups: React.Dispatch<
    React.SetStateAction<
      {
        id: string;
        address: string;
        phone: string;
        email: string;
        sendEmail: boolean;
      }[]
    >
  >;
  returnAddress: string;
  setReturnAddress: React.Dispatch<React.SetStateAction<string>>;
  shouldShowReturnAddress: boolean;

  customerLabel: string;
  setCustomerLabel: React.Dispatch<React.SetStateAction<string>>;
  customerName: string;
  setCustomerName: React.Dispatch<React.SetStateAction<string>>;
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  phoneError: string | null;
  phoneTwo: string;
  setPhoneTwo: React.Dispatch<React.SetStateAction<string>>;
  phoneTwoError: string | null;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  emailError: string | null;
  customerComments: string;
  setCustomerComments: React.Dispatch<React.SetStateAction<string>>;

  floorNo: string;
  setFloorNo: React.Dispatch<React.SetStateAction<string>>;
  lift: "yes" | "no" | "";
  setLift: React.Dispatch<React.SetStateAction<"yes" | "no" | "">>;

  cashierName: string;
  setCashierName: React.Dispatch<React.SetStateAction<string>>;
  cashierPhone: string;
  setCashierPhone: React.Dispatch<React.SetStateAction<string>>;
  cashierPhoneError: string | null;

  subcontractorId: string;
  setSubcontractorId: React.Dispatch<React.SetStateAction<string>>;
  driver: string;
  setDriver: React.Dispatch<React.SetStateAction<string>>;
  secondDriver: string;
  setSecondDriver: React.Dispatch<React.SetStateAction<string>>;
  driverInfo: string;
  setDriverInfo: React.Dispatch<React.SetStateAction<string>>;
  licensePlate: string;
  setLicensePlate: React.Dispatch<React.SetStateAction<string>>;

  deviation: string;
  setDeviation: React.Dispatch<React.SetStateAction<string>>;
  feeExtraWork: boolean;
  setFeeExtraWork: React.Dispatch<React.SetStateAction<boolean>>;
  extraWorkMinutes: number;
  setExtraWorkMinutes: React.Dispatch<React.SetStateAction<number>>;
  feeAddToOrder: boolean;
  setFeeAddToOrder: React.Dispatch<React.SetStateAction<boolean>>;
  statusNotes: string;
  setStatusNotes: React.Dispatch<React.SetStateAction<string>>;
  customerMembershipId: string;
  setCustomerMembershipId: React.Dispatch<React.SetStateAction<string>>;
  status: string;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  dontSendEmail: boolean;
  setDontSendEmail: React.Dispatch<React.SetStateAction<boolean>>;
  attachments: AttachmentItem[];
  attachmentsUploading: boolean;
  attachmentsError: string;
  capacityWarningMessage: string;
  capacityWarningCount: number;
  capacityWarningLimit: number;
  capacityWarningLoading: boolean;
  showCapacityDetails?: boolean;
  capacityHardLimitReached: boolean;
  isOrderCreator?: boolean;
  onUploadAttachment: (file: File, category: AttachmentCategory) => void | Promise<void>;
  onDeleteAttachment: (attachmentId: string) => void | Promise<void>;
};

export default function OrderFieldsForm({
  locale = "en",
  hidden,
  hideDontSendEmail,
  allowPastDeliveryDates,
  shouldLockPickupAddress,
  hideSubmitButton,
  subcontractorLoading,
  subcontractorOptions,
  changeCustomerLoading,
  changeCustomerOptions,
  saving,
  submitError,
  deliveryDateError,
  deliveryDateWarning,
  timeWindowError,
  pickupAddressError,
  deliveryAddressError,
  returnAddressError,

  orderNumber,
  setOrderNumber,
  description,
  setDescription,
  deliveryDate,
  setDeliveryDate,
  timeWindow,
  setTimeWindow,
  expressDelivery,
  setExpressDelivery,
  customTimeFrom,
  setCustomTimeFrom,
  customTimeTo,
  setCustomTimeTo,
  contactCustomerForCustomTimeWindow,
  setContactCustomerForCustomTimeWindow,
  customTimeContactNote,
  setCustomTimeContactNote,
  deliveryAddress,
  setDeliveryAddress,
  drivingDistance,
  setDrivingDistance,
  pickupAddress,
  setPickupAddress,
  extraPickups,
  setExtraPickups,
  returnAddress,
  setReturnAddress,
  shouldShowReturnAddress,
  customerName,
  setCustomerName,
  phone,
  setPhone,
  phoneError,
  phoneTwo,
  setPhoneTwo,
  phoneTwoError,
  email,
  setEmail,
  emailError,
  customerComments,
  setCustomerComments,

  setCustomerLabel,
  floorNo,
  setFloorNo,
  lift,
  setLift,

  cashierName,
  setCashierName,
  cashierPhone,
  setCashierPhone,
  cashierPhoneError,

  subcontractorId,
  setSubcontractorId,
  driver,
  setDriver,
  secondDriver,
  setSecondDriver,
  driverInfo,
  setDriverInfo,
  licensePlate,
  setLicensePlate,

  deviation,
  setDeviation,
  feeExtraWork,
  setFeeExtraWork,
  extraWorkMinutes,
  setExtraWorkMinutes,
  feeAddToOrder,
  setFeeAddToOrder,
  statusNotes,
  setStatusNotes,
  customerMembershipId,
  setCustomerMembershipId,
  status,
  setStatus,
  dontSendEmail,
  setDontSendEmail,
  attachments,
  attachmentsUploading,
  attachmentsError,
  onUploadAttachment,
  onDeleteAttachment,
  capacityWarningMessage,
  capacityWarningCount,
  capacityWarningLimit,
  capacityWarningLoading,
  showCapacityDetails = true,
  capacityHardLimitReached,
  isOrderCreator = false,
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const showLiftField = shown(hidden, OrderFields.Lift) && floorNo.trim().length > 0;
  const customTimeFromMinutes = parseCustomTimeToMinutes(customTimeFrom);
  const customTimeToMinutes = parseCustomTimeToMinutes(customTimeTo);
  const availableCustomTimeFromOptions = CUSTOM_TIME_OPTIONS.filter((option) => {
    if (customTimeToMinutes === null) {
      return true;
    }

    const optionMinutes = parseCustomTimeToMinutes(option);
    return optionMinutes !== null && optionMinutes <= customTimeToMinutes - MIN_CUSTOM_TIME_GAP_MINUTES;
  });
  const availableCustomTimeToOptions = CUSTOM_TIME_OPTIONS.filter((option) => {
    if (customTimeFromMinutes === null) {
      return true;
    }

    const optionMinutes = parseCustomTimeToMinutes(option);
    return optionMinutes !== null && optionMinutes >= customTimeFromMinutes + MIN_CUSTOM_TIME_GAP_MINUTES;
  });

  return (
    <div className="customContainer mb-20">
      {submitError ? <FieldErrorMessage message={submitError} /> : null}

      {shown(hidden, OrderFields.OrderNumber) && (
        <>
          <h1 className="font-bold py-2">{t("Order number")}</h1>
          <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="customInput w-full" />
        </>
      )}

      {shown(hidden, OrderFields.Description) && (
        <>
          <h1 className="font-bold py-2">{t("Description")}</h1>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="customInput w-full resize-y py-3 leading-normal" />
        </>
      )}

      {shown(hidden, OrderFields.DeliveryDate) && (
        <>
          <h1 className="font-bold py-2">
            {t("Delivery date")}
            <span className="text-red-600">*</span>
          </h1>
          <input
            id="order-delivery-date"
            type="date"
            value={deliveryDate}
            min={allowPastDeliveryDates ? undefined : new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="customInput w-full"
          />
          <FieldErrorMessage message={deliveryDateError} />
          <FieldErrorMessage message={deliveryDateWarning} />
        </>
      )}

      {shown(hidden, OrderFields.DeliveryTimeWindow) && (
        <>
          <h1 className="font-bold py-2">
            {t("Delivery Time window")}
            <span className="text-red-600">*</span>
          </h1>
          <select
            id="order-time-window"
            value={timeWindow}
            onChange={(e) => {
              const value = e.target.value;
              setTimeWindow(value);

              if (value !== "custom") {
                setCustomTimeFrom("");
                setCustomTimeTo("");
                setContactCustomerForCustomTimeWindow(false);
                setCustomTimeContactNote("");
              }
            }}
            className="customInput w-full"
          >
            <option value="">{t("Choose")}</option>
            <option value="10:00-16:00">10:00-16:00</option>
            <option value="16:00-21:00">16:00-21:00</option>
            <option value="custom">{t("Custom")}</option>
          </select>

          {timeWindow === "custom" && (
            <>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <h2 className="font-bold py-2">{t("From")}</h2>
                  <select
                    value={customTimeFrom}
                    onChange={(e) => {
                      const nextFrom = e.target.value;
                      const nextFromMinutes = parseCustomTimeToMinutes(nextFrom);

                      setCustomTimeFrom(nextFrom);

                      if (nextFromMinutes !== null && customTimeToMinutes !== null && customTimeToMinutes < nextFromMinutes + MIN_CUSTOM_TIME_GAP_MINUTES) {
                        setCustomTimeTo("");
                      }
                    }}
                    className="customInput w-full"
                  >
                    <option value="">{t("Choose")}</option>
                    {availableCustomTimeFromOptions.map((time) => (
                      <option key={`from-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <h2 className="font-bold py-2">{t("To")}</h2>
                  <select
                    value={customTimeTo}
                    onChange={(e) => {
                      const nextTo = e.target.value;
                      const nextToMinutes = parseCustomTimeToMinutes(nextTo);

                      setCustomTimeTo(nextTo);

                      if (nextToMinutes !== null && customTimeFromMinutes !== null && customTimeFromMinutes > nextToMinutes - MIN_CUSTOM_TIME_GAP_MINUTES) {
                        setCustomTimeFrom("");
                      }
                    }}
                    className="customInput w-full"
                  >
                    <option value="">{t("Choose")}</option>
                    {availableCustomTimeToOptions.map((time) => (
                      <option key={`to-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactCustomerForCustomTimeWindow}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setContactCustomerForCustomTimeWindow(checked);

                    if (!checked) {
                      setCustomTimeContactNote("");
                    }
                  }}
                  className="background h-4 w-4"
                />
                <span className="text-sm font-medium">{t("Contact customer?")}</span>
              </label>

              {contactCustomerForCustomTimeWindow && (
                <div className="mt-3">
                  <h2 className="font-bold py-2">{t("Contact note")}</h2>
                  <textarea
                    value={customTimeContactNote}
                    onChange={(e) => setCustomTimeContactNote(e.target.value)}
                    rows={3}
                    className="customInput w-full resize-y py-3 leading-normal"
                    placeholder={t("Optional note")}
                  />
                </div>
              )}
            </>
          )}
          {shown(hidden, OrderFields.ExpressDelivery) && (
            <label className="mt-3 flex items-center gap-2">
              <input type="checkbox" checked={expressDelivery} onChange={(e) => setExpressDelivery(e.target.checked)} className="background h-4 w-4" />
              <span className="text-sm font-medium">{locale === "nb" ? "Ekspresslevering" : "Express delivery"}</span>
            </label>
          )}
          <FieldErrorMessage message={timeWindowError} />
          {!capacityWarningLoading && capacityWarningMessage ? (
            <div
              className={`mt-2 rounded-xl px-4 py-3 text-sm ${
                capacityHardLimitReached ? "border border-red-200 bg-red-50 text-red-900" : "border border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <div className="font-semibold">{capacityHardLimitReached ? t("Error") : t("Warning")}</div>

              <div className="mt-1">{capacityWarningMessage}</div>

              {showCapacityDetails && !isOrderCreator && (
                <div className={`mt-1 text-xs ${capacityHardLimitReached ? "text-red-800" : "text-amber-800"}`}>
                  {locale === "nb" ? "Bestillinger i tidsvindu" : "Orders in slot"}: {capacityWarningCount} / {capacityWarningLimit}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {shown(hidden, OrderFields.DeliveryTimeWindow) && shown(hidden, OrderFields.PickupLocations) && <FormSectionSpacer />}

      {shown(hidden, OrderFields.PickupLocations) && (
        <PickupLocations
          disabled={shouldLockPickupAddress}
          overrideValue={shouldLockPickupAddress ? t("No shop pickup address") : undefined}
          mainAddress={pickupAddress}
          mainAddressError={pickupAddressError}
          onMainAddressChange={setPickupAddress}
          pickups={extraPickups}
          onPickupsChange={setExtraPickups}
          locale={locale}
        />
      )}

      {shown(hidden, OrderFields.DeliveryAddress) && (
        <>
          <h1 className="font-bold py-2">
            {t("Delivery address")}
            <span className="text-red-600">*</span>
          </h1>
          <AddressAutocompleteInput
            inputId="order-delivery-address"
            value={deliveryAddress}
            onChange={setDeliveryAddress}
            placeholder={t("Enter a location")}
          />
          <FieldErrorMessage message={deliveryAddressError} />

          {shouldShowReturnAddress && (
            <>
              <h1 className="font-bold py-2">{t("Return address")}</h1>
              <AddressAutocompleteInput
                inputId="order-return-address"
                value={returnAddress}
                onChange={setReturnAddress}
                placeholder={t("Enter a return location")}
              />
              <FieldErrorMessage message={returnAddressError} />
            </>
          )}
        </>
      )}

      {shown(hidden, OrderFields.DrivingDistance) && (
        <>
          <h1 className="font-bold py-2">{t("Total driving distance")}</h1>
          <input value={drivingDistance} onChange={(e) => setDrivingDistance(e.target.value)} className="customInput w-full" />
        </>
      )}

      {shown(hidden, OrderFields.DrivingDistance) && shown(hidden, OrderFields.CustomerName) && <FormSectionSpacer />}

      {shown(hidden, OrderFields.CustomerName) && (
        <>
          <h1 className="font-bold py-2">{t("Customer's name")}</h1>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="customInput w-full" />
        </>
      )}

      {shown(hidden, OrderFields.CustomerPhone1) && (
        <>
          <h1 className="font-bold py-2">
            {t("Customer's phone")}
            <span className="text-red-600">*</span>
          </h1>
          <input id="order-customer-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="customInput w-full" />
          <FieldErrorMessage message={phoneError} />
        </>
      )}

      {shown(hidden, OrderFields.CustomerPhone2) && (
        <>
          <h1 className="font-bold py-2">{t("Additional customer's phone")}</h1>
          <input
            id="order-customer-phone-two"
            type="tel"
            inputMode="tel"
            value={phoneTwo}
            onChange={(e) => setPhoneTwo(e.target.value)}
            className="customInput w-full"
          />
          <FieldErrorMessage message={phoneTwoError} />
        </>
      )}

      {shown(hidden, OrderFields.CustomerEmail) && (
        <>
          <h1 className="font-bold py-2">{t("Customer's email")}</h1>
          <input
            id="order-customer-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="customInput w-full"
          />
          <FieldErrorMessage message={emailError} />
        </>
      )}

      {shown(hidden, OrderFields.CustomerComments) && (
        <>
          <h1 className="font-bold py-2">{t("Customer comments")}</h1>
          <textarea
            value={customerComments}
            onChange={(e) => setCustomerComments(e.target.value)}
            rows={6}
            className="customInput w-full resize-y py-3 leading-normal"
          />
        </>
      )}

      {shown(hidden, OrderFields.FloorNo) && (
        <>
          <h1 className="font-bold py-2">{t("Floor No.")}</h1>
          <input value={floorNo} onChange={(e) => setFloorNo(e.target.value)} className="customInput w-full" />
        </>
      )}

      {showLiftField && (
        <>
          <h1 className="font-bold py-2">{t("Lift")}</h1>
          <label className="mr-4 inline-flex items-center gap-2">
            <input className="inline" type="radio" name="lift" checked={lift === "yes"} onChange={() => setLift("yes")} />
            <span>{t("Yes")}</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input className="inline" type="radio" name="lift" checked={lift === "no"} onChange={() => setLift("no")} />
            <span>{t("No")}</span>
          </label>
        </>
      )}

      {showLiftField && shown(hidden, OrderFields.CashierName) && <FormSectionSpacer />}

      {shown(hidden, OrderFields.CashierName) && (
        <>
          <h1 className="font-bold py-2">{t("Cashier's name")}</h1>
          <input value={cashierName} onChange={(e) => setCashierName(e.target.value)} className="customInput w-full" />
        </>
      )}

      {shown(hidden, OrderFields.CashierPhone) && (
        <>
          <h1 className="font-bold py-2">{t("Cashier's phone")}</h1>
          <input
            id="order-cashier-phone"
            type="tel"
            inputMode="tel"
            value={cashierPhone}
            onChange={(e) => setCashierPhone(e.target.value)}
            className="customInput w-full"
          />
          <FieldErrorMessage message={cashierPhoneError} />
        </>
      )}

      {shown(hidden, OrderFields.CashierPhone) && shown(hidden, OrderFields.Subcontractor) && <FormSectionSpacer />}

      {shown(hidden, OrderFields.Subcontractor) && (
        <>
          <h1 className="font-bold py-2">{t("Subcontractor")}</h1>
          <select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)} className="customInput w-full" disabled={subcontractorLoading}>
            <option value="">{subcontractorLoading ? t("Loading...") : t("Choose")}</option>

            {subcontractorOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </>
      )}

      {shown(hidden, OrderFields.Driver1) && (
        <>
          <h1 className="font-bold py-2">{t("Driver")}</h1>
          <input value={driver} onChange={(e) => setDriver(e.target.value)} className="customInput w-full" />
        </>
      )}

      {shown(hidden, OrderFields.Driver2) && (
        <>
          <h1 className="font-bold py-2">{t("Second driver")}</h1>
          <input value={secondDriver} onChange={(e) => setSecondDriver(e.target.value)} className="customInput w-full" />
        </>
      )}

      {shown(hidden, OrderFields.DriverInfo) && (
        <>
          <h1 className="font-bold py-2">{t("Info for the driver")}</h1>
          <textarea value={driverInfo} onChange={(e) => setDriverInfo(e.target.value)} rows={6} className="customInput w-full resize-y py-3 leading-normal" />
        </>
      )}

      {shown(hidden, OrderFields.LicensePlate) && (
        <>
          <h1 className="font-bold py-2">{t("License plate")}</h1>
          <input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} className="customInput w-full" />
        </>
      )}

      {shown(hidden, OrderFields.Deviation) && (
        <>
          <h1 className="font-bold py-2">{locale === "nb" ? "Avvik" : "Deviation"}</h1>
          <select value={deviation} onChange={(e) => setDeviation(e.target.value)} className="customInput w-full">
            <option value="">{t("Choose")}</option>
            {DEVIATION_FEE_OPTIONS.map((option) => (
              <option key={option.code} value={option.englishLabel}>
                {option.englishLabel}
              </option>
            ))}
          </select>
        </>
      )}

      {shown(hidden, OrderFields.FeeExtraWork) && (
        <div className="pt-2">
          <input
            type="checkbox"
            className="inline"
            checked={feeExtraWork}
            onChange={(e) => {
              setFeeExtraWork(e.target.checked);
              if (!e.target.checked) {
                setExtraWorkMinutes(0);
              }
            }}
          />
          <p className="inline pl-2">{locale === "nb" ? "Gebyr for ekstraarbeid per påbegynte" : "Fee for extra work per started"}</p>
          {feeExtraWork && (
            <div className="mt-2 max-w-[220]">
              <label className="block text-sm font-semibold text-textColorSecond">{locale === "nb" ? "Totalt minutter" : "Total minutes"}</label>
              <input
                type="number"
                min={0}
                step={1}
                className="customInput mt-1 w-full"
                value={extraWorkMinutes || ""}
                onChange={(e) => setExtraWorkMinutes(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                placeholder={locale === "nb" ? "f.eks. 25" : "e.g. 25"}
              />
            </div>
          )}
        </div>
      )}

      {shown(hidden, OrderFields.FeeAddToOrder) && (
        <div className="pt-2">
          <input type="checkbox" className="inline" checked={feeAddToOrder} onChange={(e) => setFeeAddToOrder(e.target.checked)} />
          <p className="inline pl-2">{locale === "nb" ? "Gebyr for å legge til på ordre" : "Fee for adding to order"}</p>
        </div>
      )}

      {shown(hidden, OrderFields.ChangeCustomer) && (
        <>
          <h1 className="font-bold py-2">{locale === "nb" ? "Endre butikk" : "Change store"}</h1>
          <select
            value={customerMembershipId}
            onChange={(e) => {
              const id = e.target.value;
              setCustomerMembershipId(id);

              const selected = changeCustomerOptions.find((o) => o.id === id);
              if (selected) {
                setCustomerLabel(selected.name);
              }
            }}
            className="customInput w-full"
            disabled={changeCustomerLoading}
          >
            <option value="">{changeCustomerLoading ? t("Loading...") : t("Choose")}</option>

            {changeCustomerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </>
      )}

      {shown(hidden, OrderFields.Status) && (
        <>
          <h1 className="font-bold py-2">{t("Status")}</h1>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="customInput w-full">
            <option value="">{t("Choose")}</option>
            <option value="processing">{bookingStatusText(locale, "processing")}</option>
            <option value="confirmed">{bookingStatusText(locale, "confirmed")}</option>
            <option value="active">{bookingStatusText(locale, "active")}</option>
            <option value="cancelled">{bookingStatusText(locale, "cancelled")}</option>
            <option value="failed">{bookingStatusText(locale, "failed")}</option>
            <option value="completed">{bookingStatusText(locale, "completed")}</option>
            <option value="invoiced">{bookingStatusText(locale, "invoiced")}</option>
            <option value="paid">{bookingStatusText(locale, "paid")}</option>
          </select>
        </>
      )}

      {shown(hidden, OrderFields.StatusNotes) && (
        <>
          <h1 className="font-bold py-2">{t("Status notes")}</h1>
          <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={6} className="customInput w-full resize-y py-3 leading-normal" />
        </>
      )}

      {shown(hidden, OrderFields.Attachment) && (
        <>
          <div className="mt-2">
            <label className="font-bold py-2">{t("Attachments")}</label>

            <div className="flex items-center gap-2">
              <OrderAttachmentsSection
                attachments={attachments}
                uploading={attachmentsUploading}
                error={attachmentsError}
                onUpload={onUploadAttachment}
                onDelete={onDeleteAttachment}
                locale={locale}
              />
            </div>
          </div>
        </>
      )}

      {!hideDontSendEmail && (
        <label className="flex items-center gap-2 py-2">
          <input type="checkbox" checked={dontSendEmail} onChange={(e) => setDontSendEmail(e.target.checked)} />
          <span>{locale === "nb" ? "Ikke send e-post" : "Don't send email"}</span>
        </label>
      )}
      {!hideSubmitButton && (
        <button
          className={`w-full h-12 mt-8 text-white ${capacityHardLimitReached && isOrderCreator ? "bg-red-600! customButtonEnabled cursor-not-allowed" : "customButtonEnabled"}`}
          type="submit"
          disabled={saving || (capacityHardLimitReached && isOrderCreator)}
        >
          {capacityHardLimitReached && isOrderCreator ? (locale === "nb" ? "Tidsvindu fullbooket" : "Time slot full") : saving ? t("Saving...") : t("Submit")}
        </button>
      )}
    </div>
  );
}
