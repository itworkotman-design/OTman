"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/password-reset/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data.reason === "INVALID_TOKEN") {
          setError("This reset link is invalid or has expired.");
        } else if (data.reason === "TOKEN_EXPIRED") {
          setError("This reset link has expired.");
        } else if (data.reason === "TOKEN_ALREADY_USED") {
          setError("This reset link has already been used.");
        } else if (data.reason === "INVALID_INPUT") {
          setError("Password does not meet the requirements.");
        } else {
          setError(`Could not reset password${data?.reason ? `: ${data.reason}` : "."}`);
        }
        return;
      }

      setSuccess(true);

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <div className="p-8">Invalid reset link.</div>;
  }

  return (
    <main className="w-full">
      <div className="mx-auto flex justify-center mt-30 px-4">
        <section className="w-full max-w-[420]">
          <div className="flex justify-center">
            <Image
              src="/logo.png"
              alt="Otman Transport"
              width={260}
              height={120}
              priority
              className="h-auto w-full"
            />
          </div>

          <div>
            <h1 className="text-center text-3xl font-semibold mt-6 text-logoblue">
              Reset password
            </h1>
            <p className="text-center text-md font-base my-6">
              Enter your new password below
            </p>
          </div>

          {success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              Password updated successfully. Redirecting to login...
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="newPassword"
                  className="text-[20px] pl-2 font-semibold text-logoblue"
                >
                  New password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-logoblue/30 px-3 text-sm outline-none focus:border-logoblue/60"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-[20px] pl-2 font-semibold text-logoblue"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-logoblue/30 px-3 text-sm outline-none focus:border-logoblue/60"
                />
              </div>

              {error ? <p className="text-sm text-red-600 px-1">{error}</p> : null}

              <div className="flex items-center justify-between">
                <Link href="/login" className="text-logoblue font-semibold">
                  <i className="fa-solid fa-arrow-left text-sm"></i> back
                </Link>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-50 rounded-lg bg-logoblue text-lg font-semibold text-white hover:opacity-95 active:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Save password"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}