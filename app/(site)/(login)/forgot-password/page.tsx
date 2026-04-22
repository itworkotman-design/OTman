"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");

    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok && data?.reason === "RATE_LIMITED") {
        setError("Too many attempts. Please try again later.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-full">
      <div className="mx-auto flex justify-center mt-30 px-4">
        <section className="w-full max-w-[420]">
          <div className="flex justify-center">
            <Image
              src="/LogoSVG.svg"
              alt="Otman Transport"
              width={260}
              height={120}
              priority
              className="h-auto w-full"
            />
          </div>

          <div>
            <h1 className="text-center text-3xl font-semibold mt-6 text-logoblue">
              Forgot your password?
            </h1>
            <p className="text-center text-md font-base my-6">
              We&apos;ll email you instructions on how to reset your password
            </p>
          </div>

          {success ? (
            <p className="text-sm text-green-700 rounded-lg border border-green-200 bg-green-50 p-3">
              If an account exists for that email, reset instructions have been
              sent.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[20px] pl-2 font-semibold text-logoblue"
                >
                  Username / E-mail
                </label>
                <input
                  id="email"
                  required
                  name="email"
                  type="text"
                  autoComplete="username"
                  className="h-10 w-full rounded-lg border border-logoblue/30 px-3 text-sm outline-none focus:border-logoblue/60"
                />
              </div>

              {error && <p className="text-sm text-red-600 px-1">{error}</p>}

              <div className="flex items-center justify-between">
                <Link href="/login" className="text-logoblue font-semibold">
                  <i className="fa-solid fa-arrow-left text-sm"></i> back
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-50 rounded-lg bg-logoblue text-lg font-semibold text-white hover:opacity-95 active:opacity-90 cursor-pointer disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Reset Password"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
