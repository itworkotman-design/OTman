"use client";

import { useMemo } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import {
  createEmptyExtraPickup,
  getExtraPickupValidation,
  type ExtraPickupInput,
} from "@/lib/orders/extraPickups";

type Pickup = {
  id: string;
} & ExtraPickupInput;

export function PickupLocations({
  disabled = false,
  overrideValue,
  mainAddress,
  mainAddressError,
  onMainAddressChange,
  pickups,
  onPickupsChange,
}: {
  disabled?: boolean;
  overrideValue?: string;
  mainAddress: string;
  mainAddressError?: string | null;
  onMainAddressChange: (value: string) => void;
  pickups: Pickup[];
  onPickupsChange: (pickups: Pickup[]) => void;
}) {
  const additionalDisabled = useMemo(
    () => disabled || mainAddress.trim().length === 0,
    [disabled, mainAddress],
  );

  const addPickup = () => {
    if (additionalDisabled) return;

    onPickupsChange([
      ...pickups,
      {
        id: crypto.randomUUID(),
        ...createEmptyExtraPickup(),
      },
    ]);
  };

  const updatePickup = (id: string, patch: Partial<Pickup>) => {
    onPickupsChange(pickups.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePickup = (id: string) => {
    onPickupsChange(pickups.filter((p) => p.id !== id));
  };

  const handleMainChange = (value: string) => {
    onMainAddressChange(value);

    if (value.trim().length === 0) {
      onPickupsChange([]);
    }
  };

  return (
    <div className="w-full py-2">
      <div>
        <label className="font-bold">
          Pickup address<span className="text-red-600">*</span>
        </label>
        <AddressAutocompleteInput
          inputId="order-pickup-address"
          value={disabled ? (overrideValue ?? "") : mainAddress}
          onChange={(value) => {
            if (!disabled) handleMainChange(value);
          }}
          disabled={disabled}
          placeholder="Enter a location"
        />
        {mainAddressError ? (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mainAddressError}
          </div>
        ) : null}
      </div>

      {!disabled && (
        <div>
          <div className="flex items-center justify-between py-2">
            <label className="font-bold">Additional pickup locations</label>
          </div>

          <div
            className={[
              additionalDisabled ? "pointer-events-none opacity-50" : "",
            ].join(" ")}
          >
            {pickups.map((pickup, idx) => {
              const validation = getExtraPickupValidation(pickup);

              return (
                <div
                  key={pickup.id}
                  className="my-4 rounded-xl border border-neutral-200 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-md pl-1 font-semibold">
                      Pickup {idx + 1}
                      <span className="text-red-600">*</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => removePickup(pickup.id)}
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border hover:bg-red-700 hover:text-white"
                      aria-label={`Remove pickup ${idx + 1}`}
                    >
                      -
                    </button>
                  </div>

                  <div className="mb-3">
                    <AddressAutocompleteInput
                      inputId={`extra-pickup-${pickup.id}-address`}
                      value={pickup.address}
                      onChange={(value) =>
                        updatePickup(pickup.id, { address: value })
                      }
                      placeholder="Enter a location"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Phone
                        {validation.phoneRequired ? (
                          <span className="text-red-600">*</span>
                        ) : null}
                      </label>
                      <input
                        id={`extra-pickup-${pickup.id}-phone`}
                        type="tel"
                        inputMode="tel"
                        value={pickup.phone}
                        onChange={(e) =>
                          updatePickup(pickup.id, { phone: e.target.value })
                        }
                        className="customInput w-full"
                        placeholder="Enter phone"
                      />
                      {validation.phoneError ? (
                        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {validation.phoneError}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Email
                        {validation.emailRequired ? (
                          <span className="text-red-600">*</span>
                        ) : null}
                      </label>
                      <input
                        id={`extra-pickup-${pickup.id}-email`}
                        type="email"
                        autoComplete="email"
                        value={pickup.email}
                        onChange={(e) =>
                          updatePickup(pickup.id, { email: e.target.value })
                        }
                        className="customInput w-full"
                        placeholder="Enter email"
                      />
                      {validation.emailError ? (
                        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {validation.emailError}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {validation.contactError ? (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {validation.contactError}
                    </div>
                  ) : null}

                  <label className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pickup.sendEmail}
                      onChange={(e) =>
                        updatePickup(pickup.id, { sendEmail: e.target.checked })
                      }
                    />
                    <span>Send email</span>
                  </label>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addPickup}
              disabled={additionalDisabled}
              className="customButtonDefault h-10 w-full"
            >
              Add additional pickup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
