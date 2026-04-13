import PostalMime from "postal-mime";

function normalizeAddress(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const email =
    typeof value.address === "string"
      ? value.address.trim()
      : typeof value.email === "string"
        ? value.email.trim()
        : "";

  if (!email) {
    return null;
  }

  const name =
    typeof value.name === "string" && value.name.trim()
      ? value.name.trim()
      : null;

  if (!name) {
    return email;
  }

  return `${name} <${email}>`;
}

function normalizeRecipients(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeAddress(entry))
    .filter((entry) => Boolean(entry));
}

function getHeaderValue(message, headerName) {
  if (message?.headers && typeof message.headers.get === "function") {
    return message.headers.get(headerName) || "";
  }

  return "";
}

export default {
  async email(message, env) {
    if (!env.EMAIL_FORWARD_URL) {
      throw new Error("Missing EMAIL_FORWARD_URL");
    }

    if (!env.EMAIL_INBOUND_SECRET) {
      throw new Error("Missing EMAIL_INBOUND_SECRET");
    }

    const parser = new PostalMime();
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await parser.parse(raw);

    const toRecipients = normalizeRecipients(parsed.to);
    const ccRecipients = normalizeRecipients(parsed.cc);
    const recipients = [...toRecipients, ...ccRecipients];

    const payload = {
      from: normalizeAddress(parsed.from) || message.from,
      to: toRecipients[0] || message.to,
      recipients,
      subject: typeof parsed.subject === "string" ? parsed.subject : "",
      text: typeof parsed.text === "string" ? parsed.text : "",
      html: typeof parsed.html === "string" ? parsed.html : "",
      messageId: getHeaderValue(message, "message-id"),
    };

    const forwardUrl = new URL(env.EMAIL_FORWARD_URL);
    forwardUrl.searchParams.set("secret", env.EMAIL_INBOUND_SECRET);

    const response = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Inbound email forward failed with ${response.status}: ${errorText}`,
      );
    }
  },
};
