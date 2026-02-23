"use client";

import { OrderForm, OrderPresets } from "@/app/_components/Dahsboard/booking/create/OrderForm";
import type { OrderFormPayload } from "@/app/_components/Dahsboard/booking/create/OrderForm";


export default function CreatePage() {
  const handleSubmit = (payload: OrderFormPayload) => {
    console.log("Order payload:", payload);
    // TODO: send payload to your API / database here
  };

  return <OrderForm dataset="power" hidden={OrderPresets.Power} onSubmit={handleSubmit} />;
}