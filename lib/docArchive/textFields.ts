import { prisma } from "@/lib/db";

// Host-side "text field" item content — see the ArchiveItemTextField model
// comment in schema.prisma. Ordered like ArchiveSection.order (append-only
// by default, new fields go to the end). Scoped to a single Text-fields
// ArchiveItemContentSection instance (sectionId), not the whole item — an
// item can have multiple Text-fields sections, each with its own field list.
export type ArchiveItemTextFieldRow = {
  id: string;
  label: string;
  value: string;
  order: number;
};

export async function listSectionTextFields(
  companyId: string,
  tenantId: string,
  sectionId: string,
): Promise<ArchiveItemTextFieldRow[]> {
  return prisma.archiveItemTextField.findMany({
    where: { companyId, tenantId, sectionId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, value: true, order: true },
  });
}

export async function createSectionTextField(
  companyId: string,
  tenantId: string,
  itemId: string,
  sectionId: string,
  label: string,
  value: string,
): Promise<ArchiveItemTextFieldRow> {
  const lastField = await prisma.archiveItemTextField.findFirst({
    where: { companyId, tenantId, sectionId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const field = await prisma.archiveItemTextField.create({
    data: { companyId, tenantId, itemId, sectionId, label, value, order: (lastField?.order ?? -1) + 1 },
  });

  return { id: field.id, label: field.label, value: field.value, order: field.order };
}

export type UpdateTextFieldResult = { ok: true; field: ArchiveItemTextFieldRow } | { ok: false; reason: "NOT_FOUND" };

export async function updateItemTextField(
  companyId: string,
  tenantId: string,
  fieldId: string,
  data: { label?: string; value?: string },
): Promise<UpdateTextFieldResult> {
  const existing = await prisma.archiveItemTextField.findFirst({
    where: { id: fieldId, companyId, tenantId },
    select: { id: true },
  });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const field = await prisma.archiveItemTextField.update({
    where: { id: fieldId },
    data,
  });

  return { ok: true, field: { id: field.id, label: field.label, value: field.value, order: field.order } };
}

export type DeleteTextFieldResult = { ok: true } | { ok: false; reason: "NOT_FOUND" };

export async function deleteItemTextField(
  companyId: string,
  tenantId: string,
  fieldId: string,
): Promise<DeleteTextFieldResult> {
  const result = await prisma.archiveItemTextField.deleteMany({ where: { id: fieldId, companyId, tenantId } });
  if (result.count === 0) return { ok: false, reason: "NOT_FOUND" };
  return { ok: true };
}
