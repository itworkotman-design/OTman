"use client";

import { useMemo, useState } from "react";

type Pickup = { id: string; value: string };

export function PickupLocations({
  disabled = false,
  overrideValue,
  defaultValue = "",
}: {
  disabled?: boolean;
  overrideValue?: string;
  defaultValue?: string;
}) {
  const [mainAddress, setMainAddress] = useState(defaultValue);
  const [pickups, setPickups] = useState<Pickup[]>([]);

  const additionalDisabled = useMemo(
    () => mainAddress.trim().length === 0,
    [mainAddress]
  );

  const addPickup = () => {
    if (additionalDisabled) return;
    setPickups((prev) => [
      ...prev,
      { id: crypto.randomUUID(), value: "" },
    ]);
  };

  const updatePickup = (id: string, value: string) => {
    setPickups((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  };

  const removePickup = (id: string) => {
    setPickups((prev) => prev.filter((p) => p.id !== id));
  };

  // If main address becomes empty, clear additional pickups (optional but matches your UX)
  const onMainChange = (v: string) => {
    setMainAddress(v);
    if (v.trim().length === 0) setPickups([]);
  };

  return (
    <div className="w-full py-2">
      <div>
        <label className="font-bold">Pickup address</label>
        <input
          value={disabled ? (overrideValue ?? "") : mainAddress}
          onChange={(e) => !disabled && onMainChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter a location"
          className="customInput w-full"
        />
      </div>
    
      {!disabled && (
        <div className="">
          <div className="flex items-center justify-between py-2">
            <label className="font-bold">Additional pickup locations</label>
          </div>

          <div
            className={[
              "",
              additionalDisabled ? "opacity-50 pointer-events-none " : "",
            ].join(" ")}
          >
            {pickups.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-3 my-4">
                  <span className="w-20 text-md pl-2 font-semibold">Pickup</span>
                  <input value={p.value} onChange={(e) => updatePickup(p.id, e.target.value)} placeholder="Enter a location" className="flex-1 customInput w-full"/>
                  <button type="button" onClick={() => removePickup(p.id)} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-red-700 hover:text-white cursor-pointer" aria-label={`Remove pickup ${idx + 1}`} >
                      −
                  </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addPickup}
              disabled={additionalDisabled}
              className="customButtonDefault w-full h-10">
              Add additional pickup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
