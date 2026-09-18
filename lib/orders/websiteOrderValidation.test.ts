import { describe, expect, it } from "vitest";
import {
  validateEmailField,
  validatePhoneField,
  validateTextField,
} from "./websiteOrderValidation";

describe("validatePhoneField", () => {
  it("rejects an empty phone number", () => {
    expect(validatePhoneField("")).toBe("Required");
  });

  it("accepts a well-formed Norwegian phone number", () => {
    expect(validatePhoneField("+47 123 45 678")).toBeNull();
  });

  it("rejects a phone number with disallowed characters", () => {
    expect(validatePhoneField("+47<script>")).not.toBeNull();
  });
});

describe("validateEmailField", () => {
  it("allows an empty email (optional field)", () => {
    expect(validateEmailField("")).toBeNull();
  });

  it("accepts a well-formed email", () => {
    expect(validateEmailField("customer@example.com")).toBeNull();
  });

  it("rejects a malformed email", () => {
    expect(validateEmailField("not-an-email")).not.toBeNull();
  });
});

describe("validateTextField", () => {
  it("accepts plain text", () => {
    expect(validateTextField("Storgata 1, Oslo")).toBeNull();
  });

  it("rejects text containing disallowed characters", () => {
    expect(validateTextField("<img src=x>")).not.toBeNull();
  });
});
