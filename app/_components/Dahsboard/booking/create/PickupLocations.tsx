"use client";

import { useMemo } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";

type Pickup = { id: string; value: string };

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
    () => mainAddress.trim().length === 0,
    [mainAddress],
  );

  const addPickup = () => {
    if (additionalDisabled) return;

    onPickupsChange([...pickups, { id: crypto.randomUUID(), value: "" }]);
  };

  const updatePickup = (id: string, value: string) => {
    onPickupsChange(pickups.map((p) => (p.id === id ? { ...p, value } : p)));
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
              <div key={p.id} className="flex items-center gap-3 my-4">
                <span className="w-20 text-md pl-2 font-semibold">Pickup</span>

                <AddressAutocompleteInput
                  value={p.value}
                  onChange={(value) => updatePickup(p.id, value)}
                  placeholder="Enter a location"
                />

                <button
                  type="button"
                  onClick={() => removePickup(p.id)}
                  className="grid h-8 w-8 place-items-center rounded-full border hover:bg-red-700 hover:text-white cursor-pointer"
                  aria-label={`Remove pickup ${idx + 1}`}
                >
                  −
                </button>
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
