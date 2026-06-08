import { afterEach, describe, expect, it } from "vitest";
import {
  buildOrderConversationEmailHtml,
  buildOrderConversationEmailText,
  buildReplySubject,
  buildReplyToAddress,
  extractThreadTokenFromRecipients,
  extractThreadTokenFromSubject,
  getInitialAppMessageQuoteContext,
  stripThreadTokenMarkers,
} from "./orderEmail";

describe("orderEmail helpers", () => {
  afterEach(() => {
    delete process.env.ORDER_EMAIL_LOGO_URL;
    delete process.env.EMAIL_REPLY_DOMAIN;
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

  it("builds a reply-to address on the inbound routing domain", () => {
    expect(buildReplyToAddress("thread123")).toBe(
      "reply+thread123@reply.otman.no",
    );
  });

  it("builds and parses reply addresses with the configured reply domain", () => {
    process.env.EMAIL_REPLY_DOMAIN = "replies.example.com";

    expect(buildReplyToAddress("thread123")).toBe(
      "reply+thread123@replies.example.com",
    );
    expect(
      extractThreadTokenFromRecipients("reply+thread123@replies.example.com"),
    ).toBe("thread123");
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

  it("quotes the initial app-created customer message on the first admin response", () => {
    const createdAt = new Date("2026-05-08T13:27:48.000Z");

    expect(
      getInitialAppMessageQuoteContext([
        {
          direction: "INBOUND",
          source: "APP",
          bodyText: "customer msg 1",
          fromEmail: "customer@example.com",
          fromName: "Customer",
          createdAt,
        },
      ]),
    ).toEqual({
      bodyText: "customer msg 1",
      personLabel: "Customer",
      sentAtLabel: createdAt.toLocaleString("nb-NO"),
    });
  });

  it("does not quote app context after an outbound admin response exists", () => {
    expect(
      getInitialAppMessageQuoteContext([
        {
          direction: "INBOUND",
          source: "APP",
          bodyText: "customer msg 1",
          fromEmail: "customer@example.com",
          fromName: "Customer",
          createdAt: new Date("2026-05-08T13:27:48.000Z"),
        },
        {
          direction: "OUTBOUND",
          source: "GMAIL",
          bodyText: "admin msg 1",
          fromEmail: "bestilling@otman.no",
          fromName: "Otman AS",
          createdAt: new Date("2026-05-08T13:30:00.000Z"),
        },
      ]),
    ).toBeNull();
  });

  it("does not quote Gmail or Mailgun inbound replies back to the customer", () => {
    for (const source of ["GMAIL", "MAILGUN"]) {
      expect(
        getInitialAppMessageQuoteContext([
          {
            direction: "INBOUND",
            source,
            bodyText: "customer email reply",
            fromEmail: "customer@example.com",
            fromName: "Customer",
            createdAt: new Date("2026-05-08T13:27:48.000Z"),
          },
        ]),
      ).toBeNull();
    }
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

  it("does not duplicate the email subject or order label in the body", () => {
    const text = buildOrderConversationEmailText({
      messageText: "Admin message",
      orderLabel: "Order 21236 | TEST",
      threadToken: "testtoken",
    });
    const html = buildOrderConversationEmailHtml({
      messageText: "Admin message",
      orderLabel: "Order 21236 | TEST",
      threadToken: "testtoken",
    });

    expect(text.startsWith("Admin message")).toBe(true);
    expect(text).not.toContain("Order 21236 | TEST");
    expect(html).not.toContain("Order 21236 | TEST");
  });

  it("includes the Otman logo in the HTML template", () => {
    const html = buildOrderConversationEmailHtml({
      messageText: "Admin message",
      orderLabel: "Order 21236 | TEST",
      threadToken: "testtoken",
    });

    expect(html).toContain(
      "https://public-otman-img.s3.eu-north-1.amazonaws.com/LogoLG.png",
    );
    expect(html).toContain('alt="Otman AS Logo"');
    expect(html).toContain("display:block;max-height:48px;width:auto;");
  });

  it("uses the configured public email logo URL", () => {
    process.env.ORDER_EMAIL_LOGO_URL =
      "https://s3.example.test/email-assets/logo.png";

    const html = buildOrderConversationEmailHtml({
      messageText: "Admin message",
      orderLabel: "Order 21236 | TEST",
      threadToken: "testtoken",
    });

    expect(html).toContain("https://s3.example.test/email-assets/logo.png");
  });

  it("uses the bilingual logistics signature", () => {
    const text = buildOrderConversationEmailText({
      messageText: "Admin message",
      orderLabel: "Order 21236 | TEST",
      threadToken: "testtoken",
    });
    const html = buildOrderConversationEmailHtml({
      messageText: "Admin message",
      orderLabel: "Order 21236 | TEST",
      threadToken: "testtoken",
    });

    expect(text).toContain("Med vennlig hilsen | Best regards,");
    expect(text).toContain("Logistikkavdeling | Logistics department");
    expect(text).toContain("OTMAN AS");
    expect(text).toContain("+47 402 84 977");
    expect(text).toContain("Otman AS | otman.no");
    expect(html).toContain("Med vennlig hilsen | Best regards,");
    expect(html).toContain("Logistikkavdeling | Logistics department");
    expect(html).toContain("OTMAN AS");
    expect(html).toContain("+47 402 84 977");
    expect(html).toContain('href="https://otman.no"');
  });
});
