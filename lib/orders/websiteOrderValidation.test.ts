import { describe, expect, it } from "vitest";
import {
  sanitizePhoneInput,
  sanitizeTextInput,
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

  it("rejects letters and other symbols", () => {
    expect(validatePhoneField("4123abc567")).not.toBeNull();
    expect(validatePhoneField("(412) 34.567")).not.toBeNull();
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

describe("sanitizePhoneInput", () => {
  it("keeps digits, dashes and a leading plus", () => {
    expect(sanitizePhoneInput("+47 412-34-567")).toBe("+47412-34-567");
  });

  it("drops letters, spaces and every other symbol as they are typed", () => {
    expect(sanitizePhoneInput("41a2<b>34 (567).")).toBe("41234567");
  });

  it("only keeps a plus at the very start", () => {
    expect(sanitizePhoneInput("4+12+34")).toBe("41234");
    expect(sanitizePhoneInput("++47")).toBe("+47");
  });

  it("keeps a plus that comes before the first digit of pasted text", () => {
    expect(sanitizePhoneInput("tlf: +47 (412) 34.567")).toBe("+4741234567");
  });
});

describe("sanitizeTextInput", () => {
  it("leaves ordinary text alone, including Norwegian letters", () => {
    expect(sanitizeTextInput("Ærlige Østre Ålesund, 2. etasje - nr. 4!")).toBe("Ærlige Østre Ålesund, 2. etasje - nr. 4!");
  });

  it("drops every character the server rejects", () => {
    expect(sanitizeTextInput('<script>alert("x")</script>')).toBe("scriptalert(x)/script");
    expect(sanitizeTextInput("a'b`c;d\\e{f}g[h]")).toBe("abcdefgh");
  });

  it("drops control characters but keeps line breaks for multi-line notes", () => {
    expect(sanitizeTextInput("line1\nline2\u0000\u0007")).toBe("line1\nline2");
  });

  it("produces text the server-side check accepts", () => {
    expect(validateTextField(sanitizeTextInput("<b>'hi'</b>;{}"))).toBeNull();
  });
});
