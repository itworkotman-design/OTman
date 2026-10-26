import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSmsAdminMock: vi.fn(),
  templateFindManyMock: vi.fn(),
  templateFindFirstMock: vi.fn(),
  templateCreateMock: vi.fn(),
  templateUpdateMock: vi.fn(),
  templateDeleteMock: vi.fn(),
  isSmsConfiguredMock: vi.fn(),
  transactionMock: vi.fn(),
  txExecuteRawMock: vi.fn(),
  txTemplateFindManyMock: vi.fn(),
  txTemplateCreateManyMock: vi.fn(),
}));

vi.mock("@/lib/sms/smsAccess", () => ({ requireSmsAdmin: mocks.requireSmsAdminMock }));
vi.mock("@/lib/sms/gatewayApi", () => ({ isSmsConfigured: mocks.isSmsConfiguredMock }));
vi.mock("@/lib/db", () => ({
  prisma: {
    smsTemplate: {
      findMany: mocks.templateFindManyMock,
      findFirst: mocks.templateFindFirstMock,
      create: mocks.templateCreateMock,
      update: mocks.templateUpdateMock,
      delete: mocks.templateDeleteMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[templateId]/route";
import { AUTOMATIC_SMS_TEMPLATE_DEFAULTS } from "@/lib/sms/templates";

const actor = { membershipId: "m-1", name: "Ola", email: "o@otman.no", source: "USER" };
const idParams = { params: Promise.resolve({ templateId: "t-1" }) };

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/sms/templates", { method, body: JSON.stringify(body) });
}

describe("/api/sms/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSmsAdminMock.mockResolvedValue({ ok: true, companyId: "c-1", membershipId: "m-1", actor });
    mocks.isSmsConfiguredMock.mockReturnValue(true);
    mocks.templateFindManyMock.mockResolvedValue([
      { id: "d-1", kind: "DAY_OF_DELIVERY" },
      { id: "r-1", kind: "REVIEW_REQUEST" },
    ]);
    mocks.templateFindFirstMock.mockResolvedValue({ id: "t-1", kind: "MANUAL" });
    mocks.templateCreateMock.mockImplementation(async ({ data }) => ({ id: "new", ...data }));
    mocks.templateUpdateMock.mockImplementation(async ({ data }) => ({ id: "t-1", ...data }));
    mocks.templateDeleteMock.mockResolvedValue({});
    mocks.txExecuteRawMock.mockResolvedValue(1);
    mocks.txTemplateFindManyMock.mockResolvedValue([]);
    mocks.txTemplateCreateManyMock.mockResolvedValue({ count: 0 });
    mocks.transactionMock.mockImplementation(async (fn) =>
      fn({
        $executeRaw: mocks.txExecuteRawMock,
        smsTemplate: { findMany: mocks.txTemplateFindManyMock, createMany: mocks.txTemplateCreateManyMock },
      }),
    );
  });

  it("passes through the access check's error response", async () => {
    mocks.requireSmsAdminMock.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await GET(new Request("http://localhost"))).status).toBe(403);
    expect((await POST(jsonRequest("POST", {}))).status).toBe(403);
    expect((await PATCH(jsonRequest("PATCH", {}), idParams)).status).toBe(403);
    expect((await DELETE(new Request("http://localhost"), idParams)).status).toBe(403);
  });

  it("GET creates every automatic template switched off the first time, under a per-company lock", async () => {
    mocks.templateFindManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "d-1", kind: "DAY_OF_DELIVERY" }]);

    const res = await GET(new Request("http://localhost"));
    const json = await res.json();

    expect(mocks.txExecuteRawMock).toHaveBeenCalledTimes(1);
    expect(mocks.txExecuteRawMock.mock.calls[0].slice(1)).toEqual(["sms-templates:c-1"]);
    expect(mocks.txExecuteRawMock.mock.invocationCallOrder[0]).toBeLessThan(mocks.txTemplateFindManyMock.mock.invocationCallOrder[0]);
    expect(mocks.txTemplateCreateManyMock).toHaveBeenCalledWith({
      data: (["DAY_OF_DELIVERY", "REVIEW_REQUEST"] as const).map((kind) => ({
        companyId: "c-1",
        kind,
        name: AUTOMATIC_SMS_TEMPLATE_DEFAULTS[kind].name,
        description: AUTOMATIC_SMS_TEMPLATE_DEFAULTS[kind].description,
        body: AUTOMATIC_SMS_TEMPLATE_DEFAULTS[kind].body,
        enabled: false,
      })),
    });
    expect(json).toMatchObject({ ok: true, configured: true, templates: [{ id: "d-1" }] });
    expect(json.placeholders.length).toBeGreaterThan(0);
  });

  it("GET only creates the automatic templates that are still missing once it holds the lock", async () => {
    mocks.templateFindManyMock.mockResolvedValueOnce([]);
    mocks.txTemplateFindManyMock.mockResolvedValueOnce([{ kind: "DAY_OF_DELIVERY" }]);

    await GET(new Request("http://localhost"));

    expect(mocks.txTemplateCreateManyMock).toHaveBeenCalledWith({
      data: [expect.objectContaining({ kind: "REVIEW_REQUEST" })],
    });
  });

  it("GET creates nothing when a concurrent request already seeded them (double mount / two tabs)", async () => {
    mocks.templateFindManyMock.mockResolvedValueOnce([]);
    mocks.txTemplateFindManyMock.mockResolvedValueOnce([{ kind: "DAY_OF_DELIVERY" }, { kind: "REVIEW_REQUEST" }]);

    await GET(new Request("http://localhost"));

    expect(mocks.txTemplateCreateManyMock).not.toHaveBeenCalled();
    expect(mocks.templateCreateMock).not.toHaveBeenCalled();
  });

  it("GET skips the lock entirely when the automatic templates exist", async () => {
    await GET(new Request("http://localhost"));
    expect(mocks.transactionMock).not.toHaveBeenCalled();
    expect(mocks.templateCreateMock).not.toHaveBeenCalled();
  });

  it("POST creates a manual template and validates name/body", async () => {
    expect((await POST(jsonRequest("POST", { name: "", body: "x" }))).status).toBe(400);
    expect((await POST(jsonRequest("POST", { name: "x", body: " " }))).status).toBe(400);

    const res = await POST(jsonRequest("POST", { name: " Forsinkelse ", body: "Hei {name}" }));
    expect(res.status).toBe(200);
    expect(mocks.templateCreateMock).toHaveBeenCalledWith({
      data: { companyId: "c-1", kind: "MANUAL", name: "Forsinkelse", description: null, body: "Hei {name}" },
    });
  });

  it("POST stores an optional description", async () => {
    await POST(jsonRequest("POST", { name: "Forsinkelse", description: " Brukes når sjåføren er sen ", body: "Hei" }));
    expect(mocks.templateCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: "Brukes når sjåføren er sen" }),
    });
  });

  it("PATCH updates only templates in the active company", async () => {
    mocks.templateFindFirstMock.mockResolvedValueOnce(null);
    expect((await PATCH(jsonRequest("PATCH", { enabled: true }), idParams)).status).toBe(404);
    expect(mocks.templateFindFirstMock).toHaveBeenCalledWith({ where: { id: "t-1", companyId: "c-1" }, select: { id: true, kind: true } });

    const res = await PATCH(jsonRequest("PATCH", { enabled: true, body: "Ny tekst", name: "Navn", kind: "MANUAL" }), idParams);
    expect(res.status).toBe(200);
    expect(mocks.templateUpdateMock).toHaveBeenCalledWith({
      where: { id: "t-1" },
      data: { enabled: true, body: "Ny tekst", name: "Navn" },
    });
  });

  it("PATCH rejects an empty body", async () => {
    expect((await PATCH(jsonRequest("PATCH", { body: "" }), idParams)).status).toBe(400);
  });

  it("PATCH edits a manual template's description; empty clears it", async () => {
    await PATCH(jsonRequest("PATCH", { description: " Ny beskrivelse ", name: "Forsinkelse" }), idParams);
    expect(mocks.templateUpdateMock).toHaveBeenLastCalledWith({
      where: { id: "t-1" },
      data: { description: "Ny beskrivelse", name: "Forsinkelse" },
    });

    await PATCH(jsonRequest("PATCH", { description: "  " }), idParams);
    expect(mocks.templateUpdateMock).toHaveBeenLastCalledWith({ where: { id: "t-1" }, data: { description: null } });
  });

  it("PATCH never changes an automatic template's name or description, but its text and switch stay editable", async () => {
    for (const kind of ["DAY_OF_DELIVERY", "REVIEW_REQUEST"]) {
      mocks.templateFindFirstMock.mockResolvedValueOnce({ id: "t-1", kind });
      const nameRes = await PATCH(jsonRequest("PATCH", { name: "Nytt navn" }), idParams);
      expect(nameRes.status).toBe(400);
      expect(await nameRes.json()).toEqual({ ok: false, reason: "AUTOMATIC_TEMPLATE_DETAILS_LOCKED" });

      mocks.templateFindFirstMock.mockResolvedValueOnce({ id: "t-1", kind });
      expect((await PATCH(jsonRequest("PATCH", { description: "Ny" }), idParams)).status).toBe(400);
    }
    expect(mocks.templateUpdateMock).not.toHaveBeenCalled();

    mocks.templateFindFirstMock.mockResolvedValueOnce({ id: "t-1", kind: "DAY_OF_DELIVERY" });
    expect((await PATCH(jsonRequest("PATCH", { body: "Ny tekst", enabled: true }), idParams)).status).toBe(200);
    expect(mocks.templateUpdateMock).toHaveBeenCalledWith({ where: { id: "t-1" }, data: { enabled: true, body: "Ny tekst" } });
  });

  it("DELETE removes a manual template but never an automatic one", async () => {
    expect((await DELETE(new Request("http://localhost"), idParams)).status).toBe(200);
    expect(mocks.templateDeleteMock).toHaveBeenCalledWith({ where: { id: "t-1" } });

    mocks.templateFindFirstMock.mockResolvedValueOnce({ id: "t-1", kind: "DAY_OF_DELIVERY" });
    expect((await DELETE(new Request("http://localhost"), idParams)).status).toBe(400);

    mocks.templateFindFirstMock.mockResolvedValueOnce({ id: "t-1", kind: "REVIEW_REQUEST" });
    expect((await DELETE(new Request("http://localhost"), idParams)).status).toBe(400);
    expect(mocks.templateDeleteMock).toHaveBeenCalledTimes(1);
  });
});
