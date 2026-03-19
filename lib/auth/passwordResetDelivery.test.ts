import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPasswordResetUrl,
  clearPasswordResetDeliveryAdapter,
  deliverPasswordReset,
  registerPasswordResetDeliveryAdapter,
} from "./passwordResetDelivery";

const ORIGINAL_ENV = { ...process.env };

describe("passwordResetDelivery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearPasswordResetDeliveryAdapter();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.PASSWORD_RESET_BASE_URL;
    process.env = { ...process.env, NODE_ENV: "test" };
  });

  afterEach(() => {
    clearPasswordResetDeliveryAdapter();
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("builds reset url with token query param", () => {
    process.env.PASSWORD_RESET_BASE_URL = "https://example.com/reset-password";

    const result = buildPasswordResetUrl("plain-reset-token");

    expect(result).toBe(
      "https://example.com/reset-password?token=plain-reset-token"
    );
  });

  it("throws when building url without base url", () => {
    expect(() => buildPasswordResetUrl("plain-reset-token")).toThrow(
      "PASSWORD_RESET_BASE_URL is not configured"
    );
  });

  it("uses registered adapter with email and resetUrl", async () => {
    process.env.PASSWORD_RESET_BASE_URL = "https://example.com/reset-password";
    const adapter = vi.fn().mockResolvedValue(undefined);

    registerPasswordResetDeliveryAdapter(adapter);

    await deliverPasswordReset({
      email: "test@example.com",
      token: "plain-reset-token",
    });

    expect(adapter).toHaveBeenCalledWith({
      email: "test@example.com",
      resetUrl: "https://example.com/reset-password?token=plain-reset-token",
    });
  });

  it("throws when adapter exists but base url is missing", async () => {
    const adapter = vi.fn().mockResolvedValue(undefined);
    registerPasswordResetDeliveryAdapter(adapter);

    await expect(
      deliverPasswordReset({
        email: "test@example.com",
        token: "plain-reset-token",
      })
    ).rejects.toThrow("PASSWORD_RESET_BASE_URL is not configured");

    expect(adapter).not.toHaveBeenCalled();
  });

  it("logs full reset link in non-production when base url exists and no adapter is registered", async () => {
    process.env.PASSWORD_RESET_BASE_URL = "https://example.com/reset-password";
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await deliverPasswordReset({
      email: "test@example.com",
      token: "plain-reset-token",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[auth] Password reset link for test@example.com: https://example.com/reset-password?token=plain-reset-token"
    );
  });

  it("logs raw token in non-production when base url is missing and no adapter is registered", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await deliverPasswordReset({
      email: "test@example.com",
      token: "plain-reset-token",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[auth] Password reset token for test@example.com: plain-reset-token"
    );
  });

  it("throws in production when no adapter is registered", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    await expect(
      deliverPasswordReset({
        email: "test@example.com",
        token: "plain-reset-token",
      })
    ).rejects.toThrow(
      "Password reset delivery adapter is not configured in production"
    );
  });
});

