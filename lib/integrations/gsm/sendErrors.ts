// path: lib/integrations/gsm/sendErrors.ts
// Turns everything that can stop an order from reaching GSM into a message
// staff can act on: problems found before sending (GsmOrderValidationError),
// GSM API rejections (GsmApiError) and network/config failures.

export class GsmOrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GsmOrderValidationError";
  }
}

export class GsmApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: unknown;

  constructor(status: number, path: string, body: unknown) {
    // The message stays the raw body so existing logs/tests keep working.
    super(body !== null && body !== undefined ? JSON.stringify(body) : `GSM request failed (${status})`);
    this.name = "GsmApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

const FIELD_LABELS: Record<string, string> = {
  complete_after: "time window start",
  complete_before: "time window end",
  raw_address: "address",
  address: "address",
  location: "map location",
  phones: "phone number",
  emails: "email",
  contact: "contact",
  name: "name",
  account: "GSM account",
  category: "task type",
  description: "description",
  reference: "reference",
  external_id: "external ID",
  orderer: "orderer",
  metafields: "extra fields",
  non_field_errors: "",
  detail: "",
};

const TASK_CATEGORY_LABELS: Record<string, string> = {
  pick_up: "pick-up",
  drop_off: "drop-off",
  assignment: "delivery",
};

function fieldLabel(key: string) {
  return key in FIELD_LABELS ? FIELD_LABELS[key] : key.replaceAll("_", " ");
}

/** Flattens a DRF-style error body into "where: message" lines. */
function flattenErrorBody(
  value: unknown,
  path: string[],
  taskCategories: Array<string | undefined>,
): string[] {
  if (value === null || value === undefined) return [];

  if (typeof value === "string") {
    const where = path.filter(Boolean).join(" › ");
    return [where ? `${where}: ${value}` : value];
  }

  if (Array.isArray(value)) {
    // A list of strings is a list of messages for the same field.
    if (value.every((entry) => typeof entry === "string")) {
      return value.flatMap((entry) => flattenErrorBody(entry, path, taskCategories));
    }
    // A list of objects is per-item errors (e.g. one per task).
    return value.flatMap((entry, index) => {
      const isTaskList = path[path.length - 1] === "tasks";
      const category = isTaskList ? taskCategories[index] : undefined;
      const label = isTaskList
        ? `stop ${index + 1}${category ? ` (${TASK_CATEGORY_LABELS[category] ?? category})` : ""}`
        : `#${index + 1}`;
      const parent = isTaskList ? path.slice(0, -1) : path;
      return flattenErrorBody(entry, [...parent, label], taskCategories);
    });
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      flattenErrorBody(entry, [...path, key === "tasks_data" ? "tasks" : fieldLabel(key)], taskCategories),
    );
  }

  return [String(value)];
}

function describeApiError(error: GsmApiError, taskCategories: Array<string | undefined>) {
  const { status } = error;

  if (status === 401) {
    return "GSM rejected our login (401). The GSM API key is missing, wrong or expired — check GSM_API_KEY on the server.";
  }
  if (status === 403) {
    return "GSM denied access (403). The GSM API key does not have permission for this account.";
  }
  if (status === 404) {
    return `GSM could not find what we asked for (404, ${error.path}). Check GSM_ACCOUNT_URL on the server.`;
  }
  if (status === 429) {
    return "GSM is rate-limiting us (429). Wait a minute and try again.";
  }
  if (status >= 500) {
    return `GSM is having problems right now (${status}). Try again in a few minutes.`;
  }

  const details = flattenErrorBody(error.body, [], taskCategories);
  const prefix = `GSM rejected the order (${status})`;
  return details.length > 0 ? `${prefix}: ${details.join("; ")}` : `${prefix}.`;
}

/** A human-readable reason why sending an order to GSM failed. */
export function describeGsmSendError(
  error: unknown,
  options: { taskCategories?: Array<string | undefined> } = {},
): string {
  const taskCategories = options.taskCategories ?? [];

  if (error instanceof GsmOrderValidationError) return error.message;
  if (error instanceof GsmApiError) return describeApiError(error, taskCategories);

  if (error instanceof Error) {
    if (error.message === "Missing GSM_ACCOUNT_URL") {
      return "GSM is not configured on the server (GSM_ACCOUNT_URL is missing).";
    }
    if (error.message === "Missing GSM credentials") {
      return "GSM is not configured on the server (no GSM_API_KEY or username/password).";
    }
    if (error.message.startsWith("GSM authentication failed")) {
      return `Could not log in to GSM: ${error.message}`;
    }
    if (error.message === "GSM order id missing from response") {
      return "GSM answered but did not return an order ID — check GSM to see whether the order was created before sending again.";
    }
    if (error.name === "TypeError" && /fetch/i.test(error.message)) {
      return "Could not reach GSM (network error). Check the internet connection / GSM status and try again.";
    }
    if (/^Prisma/.test(error.name)) {
      return `The order may have been created in GSM, but saving the result in our database failed: ${error.message}`;
    }
    return error.message;
  }

  return "Unknown error while sending to GSM.";
}

/** Readable text for the top-level `reason` codes the send route returns. */
export function describeGsmSendReason(reason: string | undefined | null): string {
  switch (reason) {
    case "UNAUTHORIZED":
      return "You are not logged in. Log in again and retry.";
    case "TENANT_SELECTION_REQUIRED":
      return "Select a company before sending to GSM.";
    case "FORBIDDEN":
      return "Only owners and admins can send orders to GSM.";
    case "INVALID_ORDER_IDS":
      return "No valid orders were selected.";
    case "ORDERS_NOT_FOUND":
      return "The selected orders were not found in the active company (they may have been deleted or belong to another company).";
    default:
      return reason ? `Failed to send to GSM: ${reason}` : "Failed to send to GSM.";
  }
}

type GsmSendResult = {
  ok: boolean;
  orderNumber?: string;
  displayId?: number | null;
  error?: string;
  receiptError?: string;
};

function resultLabel(result: GsmSendResult) {
  const id = result.displayId != null ? `ID${result.displayId}` : null;
  const parts = [id, result.orderNumber?.trim() || null].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Order";
}

/**
 * The text shown after a send: one line per failed order (and per receipt
 * upload problem), or "" when everything went through.
 */
export function formatGsmSendFailures(results: GsmSendResult[]): string {
  const failed = results.filter((r) => !r.ok);
  const receiptProblems = results.filter((r) => r.ok && r.receiptError);

  const lines: string[] = [];

  if (failed.length > 0) {
    const sentCount = results.length - failed.length;
    lines.push(
      sentCount > 0
        ? `${sentCount} of ${results.length} orders were sent. ${failed.length} failed:`
        : failed.length === 1
          ? "The order was not sent to GSM:"
          : `None of the ${failed.length} orders were sent to GSM:`,
    );
    for (const r of failed) {
      lines.push(`• ${resultLabel(r)}: ${r.error || "Unknown error"}`);
    }
  }

  if (receiptProblems.length > 0) {
    lines.push("Sent to GSM, but receipts could not be attached:");
    for (const r of receiptProblems) {
      lines.push(`• ${resultLabel(r)}: ${r.receiptError}`);
    }
  }

  return lines.join("\n");
}
