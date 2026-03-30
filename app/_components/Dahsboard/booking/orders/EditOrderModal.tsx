"use client";

import { useRef } from "react";
import type { OrderRow } from "@/lib/_mockdb";

type Props = {
  isOpen: boolean;
  order: OrderRow | null;
  onClose: () => void;
  onUpdate: (orderId: string, data: OrderFormInitialValues) => void;
};

export function EditOrderModal({ isOpen, order, onClose, onUpdate }: Props) {
  // Capture the latest form payload without needing a submit event
  const latestPayload = useRef<OrderFormInitialValues>({});

  if (!isOpen || !order) return null;

  // Map OrderRow fields → OrderFormInitialValues
  //NEED TO ADD CALCULATOR TO THIS ALSO LATER
  const initialValues: OrderFormInitialValues = {
    orderNumber:     order.orderNo,
    description:     order.description,
    deliveryDate:    order.deliveryDate,
    timeWindow:      order.timeWindow,
    deliveryAddress: order.deliveryAddress,
    customerName:    order.name,
    phone:           order.phone,
    cashierName:     order.cashierName,
    cashierPhone:    order.cashierPhone,
    subcontractor:   order.subcontractor,
    driverInfo:      order.driverInfo,
    status:          order.status,
    cardItems:        order.cardItems,
    cardDeliveryType: order.cardDeliveryType,
    cardProducts:     order.cardProducts,
    priceExVat:         order.priceExVat,
    priceSubcontractor: order.priceSubcontractor,
    rabatt:             order.rabatt            != null ? String(order.rabatt)            : "",
    leggTil:            order.leggTil           != null ? String(order.leggTil)           : "",
    subcontractorMinus: order.subcontractorMinus != null ? String(order.subcontractorMinus) : "",
    subcontractorPlus:  order.subcontractorPlus  != null ? String(order.subcontractorPlus)  : "",
};

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-xl flex flex-col">

        {/* Header */}
        <div className="grid grid-cols-3 items-center px-6 pt-6 pb-4 border-b-2 border-logoblue shrink-0">
          <div />
          <h1 className="text-center font-semibold text-2xl text-logoblue">
            Edit Order <span className="text-neutral-400 text-lg">#{order.orderNo}</span>
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto bg-logoblue text-white w-8 h-8 rounded-full font-bold grid place-items-center cursor-pointer"
          >
            <span className="-translate-y-px">x</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <OrderForm
            initialValues={initialValues}
            hideSubmitButton
            onSubmit={(payload) => {
              // Keep latestPayload in sync whenever the form submits internally
              latestPayload.current = payload;
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-logoblue shrink-0 flex justify-center">
          <button
            type="button"
            onClick={() => {
              // Trigger the hidden form submit to collect current values
              const form = document.getElementById("edit-order-form") as HTMLFormElement | null;
              form?.requestSubmit();
              // one tick to process the submit handler
              setTimeout(() => {
                onUpdate(order.id, latestPayload.current);
                onClose();
              }, 0);
            }}
            className="bg-logoblue text-white w-96 py-3 rounded-full font-semibold cursor-pointer hover:opacity-90"
          >
            Update Order
          </button>
        </div>
      </div>
    </div>
  );
}