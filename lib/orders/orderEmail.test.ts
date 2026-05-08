import { describe, expect, it } from "vitest";
import {
  buildOrderConversationEmailHtml,
  buildOrderConversationEmailText,
  buildReplySubject,
  buildReplyToAddress,
  extractThreadTokenFromRecipients,
  extractThreadTokenFromSubject,
  stripThreadTokenMarkers,
} from "./orderEmail";

describe("orderEmail helpers", () => {
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

  it("builds a reply-to address on the inbound routing domain", () => {
    expect(buildReplyToAddress("thread123")).toBe(
      "reply+thread123@reply.otman.no",
    );
  });

  it("prefixes reply subjects once", () => {
    expect(buildReplySubject("Order 20001")).toBe("Re: Order 20001");
    expect(buildReplySubject("Re: Order 20001")).toBe("Re: Order 20001");
  });

  it("builds reply email content with quoted context", () => {
    const text = buildOrderConversationEmailText({
      messageText: "New reply",
      orderLabel: "Order 20001",
      threadToken: "testtoken",
      replyContext: {
        bodyText: "Original line\n\n[OTMAN:testtoken]",
        personLabel: "Customer <customer@example.com>",
        sentAtLabel: "13.04.2026, 15:46",
      },
    });
    const html = buildOrderConversationEmailHtml({
      messageText: "New reply",
      orderLabel: "Order 20001",
      threadToken: "thread123",
      replyContext: {
        bodyText: "Original line\n\n[OTMAN:thread123]",
        personLabel: "Customer <customer@example.com>",
        sentAtLabel: "13.04.2026, 15:46",
      },
    });

    expect(text).toContain("On 13.04.2026, 15:46, Customer <customer@example.com> wrote:");
    expect(text).toContain("> Original line");
    expect(text).not.toContain("[OTMAN:");
    expect(html).toContain("On 13.04.2026, 15:46, Customer &lt;customer@example.com&gt; wrote:");
    expect(html).toContain("Original line");
    expect(html).not.toContain("[OTMAN:");
  });

  it("strips visible thread markers from generated content", () => {
    expect(stripThreadTokenMarkers("Hello\n\n[OTMAN:abc123]\n\nThanks")).toBe(
      "Hello\n\nThanks",
    );

    const text = buildOrderConversationEmailText({
      messageText: "New reply",
      orderLabel: "Order 20001",
      threadToken: "testtoken",
    });
    const html = buildOrderConversationEmailHtml({
      messageText: "New reply",
      orderLabel: "Order 20001",
      threadToken: "testtoken",
    });

    expect(text).not.toContain("[OTMAN:");
    expect(html).not.toContain("[OTMAN:");
  });
});
