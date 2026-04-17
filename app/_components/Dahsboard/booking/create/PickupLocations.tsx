"use client";

import { useMemo } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";

type Pickup = {
  id: string;
  address: string;
  phone: string;
  email: string;
  sendEmail: boolean;
};

export function PickupLocations({
  disabled = false,
  overrideValue,
  mainAddress,
  onMainAddressChange,
  pickups,
  onPickupsChange,
}: {
  disabled?: boolean;
  overrideValue?: string;
  mainAddress: string;
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
        address: "",
        phone: "",
        email: "",
        sendEmail: true,
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
        <label className="font-bold">Pickup address</label>
        <AddressAutocompleteInput
          value={disabled ? (overrideValue ?? "") : mainAddress}
          onChange={(value) => {
            if (!disabled) handleMainChange(value);
          }}
          disabled={disabled}
          placeholder="Enter a location"
        />
      </div>

      {!disabled && (
        <div>
          <div className="flex items-center justify-between py-2">
            <label className="font-bold">Additional pickup locations</label>
          </div>

          <div
            className={[
              additionalDisabled ? "opacity-50 pointer-events-none" : "",
            ].join(" ")}
          >
            {pickups.map((p, idx) => (
              <div
                key={p.id}
                className="my-4 rounded-xl border border-neutral-200 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-md pl-1 font-semibold">
                    Pickup {idx + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removePickup(p.id)}
                    className="grid h-8 w-8 place-items-center rounded-full border hover:bg-red-700 hover:text-white cursor-pointer"
                    aria-label={`Remove pickup ${idx + 1}`}
                  >
                    −
                  </button>
                </div>

                <div className="mb-3">
                  <AddressAutocompleteInput
                    value={p.address}
                    onChange={(value) => updatePickup(p.id, { address: value })}
                    placeholder="Enter a location"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Phone
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={p.phone}
                      onChange={(e) =>
                        updatePickup(p.id, { phone: e.target.value })
                      }
                      className="customInput w-full"
                      placeholder="Enter phone"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Email <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={p.email}
                      onChange={(e) =>
                        updatePickup(p.id, { email: e.target.value })
                      }
                      className="customInput w-full"
                      placeholder="Enter email"
                    />
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.sendEmail}
                    onChange={(e) =>
                      updatePickup(p.id, { sendEmail: e.target.checked })
                    }
                  />
                  <span>Send email</span>
                </label>
              </div>
            ))}

            <button
              type="button"
              onClick={addPickup}
              disabled={additionalDisabled}
              className="customButtonDefault w-full h-10"
            >
              Add additional pickup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
