import { afterEach, describe, expect, it } from "vitest";
import {
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
});
