import { afterEach, describe, expect, it } from "vitest";
import {
  buildOrderConversationEmailHtml,
  buildOrderConversationEmailText,
  buildReplySubject,
  buildReplyToAddress,
  buildThreadedSubject,
  extractThreadTokenFromRecipients,
  extractThreadTokenFromSubject,
} from "./orderEmail";

describe("orderEmail helpers", () => {
  const originalReplyDomain = process.env.EMAIL_REPLY_DOMAIN;

  afterEach(() => {
    process.env.EMAIL_REPLY_DOMAIN = originalReplyDomain;
  });

  it("appends the thread token to the subject once", () => {
    expect(buildThreadedSubject("Order 20001", "abc123")).toBe(
      "Order 20001 [OTMAN:abc123]",
    );
    expect(
      buildThreadedSubject("Order 20001 [OTMAN:abc123]", "abc123"),
    ).toBe("Order 20001 [OTMAN:abc123]");
  });

  it("extracts the thread token from subject and recipients", () => {
    expect(extractThreadTokenFromSubject("Re: Test [OTMAN:abc123]")).toBe(
      "abc123",
    );
    expect(
      extractThreadTokenFromRecipients([
        "reply+thread999@otman.no",
        "other@example.com",
      ]),
    ).toBe("thread999");
  });

  it("builds a reply-to address from the configured domain", () => {
    process.env.EMAIL_REPLY_DOMAIN = "otman.no";

    expect(buildReplyToAddress("thread123")).toBe(
      "reply+thread123@otman.no",
    );
  });

  it("returns null when reply domain is not configured", () => {
    delete process.env.EMAIL_REPLY_DOMAIN;

    expect(buildReplyToAddress("thread123")).toBeNull();
  });

  it("prefixes reply subjects once", () => {
    expect(buildReplySubject("Order 20001")).toBe("Re: Order 20001");
    expect(buildReplySubject("Re: Order 20001")).toBe("Re: Order 20001");
  });

  it("builds reply email content with quoted context", () => {
    const text = buildOrderConversationEmailText({
      messageText: "New reply",
      orderLabel: "Order 20001",
      replyContext: {
        bodyText: "Original line",
        personLabel: "Customer <customer@example.com>",
        sentAtLabel: "13.04.2026, 15:46",
      },
    });
    const html = buildOrderConversationEmailHtml({
      messageText: "New reply",
      orderLabel: "Order 20001",
      threadToken: "thread123",
      replyContext: {
        bodyText: "Original line",
        personLabel: "Customer <customer@example.com>",
        sentAtLabel: "13.04.2026, 15:46",
      },
    });

    expect(text).toContain("On 13.04.2026, 15:46, Customer <customer@example.com> wrote:");
    expect(text).toContain("> Original line");
    expect(html).toContain("On 13.04.2026, 15:46, Customer &lt;customer@example.com&gt; wrote:");
    expect(html).toContain("Original line");
  });
});
