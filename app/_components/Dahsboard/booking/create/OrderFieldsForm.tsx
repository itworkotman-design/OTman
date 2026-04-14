"use client";

import React from "react";
import {
  OrderFields,
  shown,
  type HiddenMask,
} from "@/app/_components/Dahsboard/booking/create/orderFields";
import { PickupLocations } from "@/app/_components/Dahsboard/booking/create/PickupLocations";
import { UserOption } from "@/lib/users/types";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import OrderAttachmentsSection from "@/app/_components/Dahsboard/booking/create/OrderAttachmentsSection";

type Props = {
  hidden: HiddenMask;
  hideDontSendEmail: boolean;
  isInstallationOnly: boolean;
  isReturnOnly: boolean;
  hideSubmitButton: boolean;
  subcontractorLoading: boolean;
  subcontractorOptions: UserOption[];
  changeCustomerLoading: boolean;
  changeCustomerOptions: UserOption[];
  saving: boolean;
  submitError: string;

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
  deliveryAddress: string;
  setDeliveryAddress: React.Dispatch<React.SetStateAction<string>>;
  drivingDistance: string;
  setDrivingDistance: React.Dispatch<React.SetStateAction<string>>;
  pickupAddress: string;
  setPickupAddress: React.Dispatch<React.SetStateAction<string>>;
  extraPickups: { id: string; value: string }[];
  setExtraPickups: React.Dispatch<
    React.SetStateAction<{ id: string; value: string }[]>
  >;
  returnAddress: string;
  setReturnAddress: React.Dispatch<React.SetStateAction<string>>;
  hasSelectedReturnOption: boolean;

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
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  }[];
  attachmentsUploading: boolean;
  attachmentsError: string;
  onUploadAttachment: (file: File) => void | Promise<void>;
  onDeleteAttachment: (attachmentId: string) => void | Promise<void>;
};

export default function OrderFieldsForm({
  hidden,
  hideDontSendEmail,
  isReturnOnly,
  hideSubmitButton,
  subcontractorLoading,
  subcontractorOptions,
  changeCustomerLoading,
  changeCustomerOptions,
  saving,
  submitError,

  orderNumber,
  setOrderNumber,
  description,
  setDescription,
  modelNr,
  setModelNr,
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
  hasSelectedReturnOption,
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
}: Props) {
  return (
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
            type="date"
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
            onChange={(e) => {
              const value = e.target.value;
              setTimeWindow(value);

              if (value !== "custom") {
                setCustomTimeFrom("");
                setCustomTimeTo("");
              }
            }}
            className="customInput w-full"
          >
            <option value="">Choose</option>
            <option value="10:00-16:00">10:00-16:00</option>
            <option value="16:00-21:00">16:00-21:00</option>
            <option value="custom">Custom</option>
          </select>

          {timeWindow === "custom" && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <h2 className="font-bold py-2">From</h2>
                <input
                  type="time"
                  value={customTimeFrom}
                  onChange={(e) => setCustomTimeFrom(e.target.value)}
                  className="customInput w-full"
                />
              </div>

              <div>
                <h2 className="font-bold py-2">To</h2>
                <input
                  type="time"
                  value={customTimeTo}
                  onChange={(e) => setCustomTimeTo(e.target.value)}
                  className="customInput w-full"
                />
              </div>
            </div>
          )}

          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={expressDelivery}
              onChange={(e) => setExpressDelivery(e.target.checked)}
              className="background h-4 w-4"
            />
            <span className="text-sm font-medium">Express delivery</span>
          </label>
        </>
      )}

      {shown(hidden, OrderFields.PickupLocations) && (
        <PickupLocations
          disabled={isReturnOnly}
          overrideValue={isReturnOnly ? "Product already at client" : undefined}
          mainAddress={pickupAddress}
          onMainAddressChange={setPickupAddress}
          pickups={extraPickups}
          onPickupsChange={setExtraPickups}
        />
      )}

      {shown(hidden, OrderFields.DeliveryAddress) && (
        <>
          <h1 className="font-bold py-2">Delivery address</h1>
          <AddressAutocompleteInput
            value={deliveryAddress}
            onChange={setDeliveryAddress}
            placeholder="Enter a location"
          />

          {hasSelectedReturnOption && (
            <>
              <h1 className="font-bold py-2">Return address</h1>
              <AddressAutocompleteInput
                value={returnAddress}
                onChange={setReturnAddress}
                placeholder="Enter a return location"
              />
            </>
          )}
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
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="customInput w-full"
          />
          {phoneError ? (
            <p className="mt-1 text-sm text-red-600">{phoneError}</p>
          ) : null}
        </>
      )}

      {shown(hidden, OrderFields.CustomerPhone2) && (
        <>
          <h1 className="font-bold py-2">Additional customer&apos;s phone</h1>
          <input
            type="tel"
            inputMode="tel"
            value={phoneTwo}
            onChange={(e) => setPhoneTwo(e.target.value)}
            className="customInput w-full"
          />
          {phoneTwoError ? (
            <p className="mt-1 text-sm text-red-600">{phoneTwoError}</p>
          ) : null}
        </>
      )}

      {shown(hidden, OrderFields.CustomerEmail) && (
        <>
          <h1 className="font-bold py-2">Customer&apos;s email</h1>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="customInput w-full"
          />
          {emailError ? (
            <p className="mt-1 text-sm text-red-600">{emailError}</p>
          ) : null}
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
            inputMode="tel"
            value={cashierPhone}
            onChange={(e) => setCashierPhone(e.target.value)}
            className="customInput w-full"
          />
          {cashierPhoneError ? (
            <p className="mt-1 text-sm text-red-600">{cashierPhoneError}</p>
          ) : null}
        </>
      )}

      {shown(hidden, OrderFields.Subcontractor) && (
        <>
          <h1 className="font-bold py-2">Subcontractor</h1>
          <select
            value={subcontractorId}
            onChange={(e) => setSubcontractorId(e.target.value)}
            className="customInput w-full"
            disabled={subcontractorLoading}
          >
            <option value="">
              {subcontractorLoading ? "Loading..." : "Choose"}
            </option>

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
            <option>Deviation, missed trip; Customer not at home</option>
            <option>Deviation, dead end; Customer cancelled</option>
            <option>Deviation, missed delivery; Damaged goods</option>
            <option>Deviation, delivery toll stairs; Wrong item</option>
            <option>Deviation, toll; Wrong address</option>
            <option>Deviation, toll trip; New driving date</option>
            <option>
              Deviation, missed trip; Warehouse cannot find the product
            </option>
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
            className="customInput w-full h-30"
          />
        </>
      )}

      {shown(hidden, OrderFields.ChangeCustomer) && (
        <>
          <h1 className="font-bold py-2">Change customer</h1>
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
            <option value="">
              {changeCustomerLoading ? "Loading..." : "Choose"}
            </option>

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
          <div className="mt-2">
            <label className="font-bold py-2">Attachments</label>

            <div className="flex items-center gap-2">
              <OrderAttachmentsSection
                attachments={attachments}
                uploading={attachmentsUploading}
                error={attachmentsError}
                onUpload={onUploadAttachment}
                onDelete={onDeleteAttachment}
              />
            </div>
          </div>
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
      {submitError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}
      {!hideSubmitButton && (
        <button
          className="w-full customButtonEnabled h-12 mt-8"
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving..." : "Submit"}
        </button>
      )}
    </div>
  );
}
