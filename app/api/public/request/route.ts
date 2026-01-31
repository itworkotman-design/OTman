import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type CreateRequestPayload = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message?: string;
  preferredFrom?: string;
  preferredTo?: string;
  items?: {
    serviceId?: string;
    titleSnapshot: string;
    quantity?: number;
    notes?: string;
  }[];
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request) {
  let payload: CreateRequestPayload;

  try {
    payload = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!payload.customerName || payload.customerName.trim().length < 2) {
    return badRequest("Customer name is required");
  }

  if (!payload.customerEmail || !payload.customerEmail.includes("@")) {
    return badRequest("Valid email is required");
  }

  if (!payload.items || payload.items.length === 0) {
    return badRequest("At least one service must be selected");
  }

  try {
    await prisma.request.create({
      data: {
        customerName: payload.customerName.trim(),
        customerEmail: payload.customerEmail.trim(),
        customerPhone: payload.customerPhone?.trim() || null,
        message: payload.message?.trim() || null,
        preferredFrom: payload.preferredFrom
          ? new Date(payload.preferredFrom)
          : null,
        preferredTo: payload.preferredTo
          ? new Date(payload.preferredTo)
          : null,
        items: {
          create: payload.items.map((item) => ({
            serviceId: item.serviceId || null,
            titleSnapshot: item.titleSnapshot,
            quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
            notes: item.notes?.trim() || null,
          })),
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Create request failed", err);
    return NextResponse.json(
      { ok: false, error: "Unable to submit request" },
      { status: 500 }
    );
  }
}
