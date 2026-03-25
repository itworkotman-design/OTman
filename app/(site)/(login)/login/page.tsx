"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const loginData = await loginRes.json().catch(() => null);

      if (!loginRes.ok) {
        if (loginData?.reason === "RATE_LIMITED") {
          setError("Too many login attempts. Try again later.");
        } else if (loginData?.reason === "USER_DISABLED") {
          setError("This user account is disabled.");
        } else {
          setError("Invalid email or password.");
        }
        return;
      }

      const meRes = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      const meData = await meRes.json().catch(() => null);

      if (!meRes.ok || !meData?.ok) {
        setError("Session could not be verified.");
        return;
      }

      if (meData.requiresTenantSelection) {
        router.push("/select-company");
        return;
      }

      const memberships = Array.isArray(meData.memberships) ? meData.memberships : [];
      const activeCompanyId = meData?.session?.activeCompanyId ?? null;

      const activeMembership =
        activeCompanyId === null
          ? null
          : memberships.find(
              (m: { companyId: string; role: string }) =>
                m.companyId === activeCompanyId
            ) ?? null;

      if (!activeMembership) {
        if (memberships.length === 1) {
          router.push("/select-company");
          return;
        }

        setError("No active company could be selected for this account.");
        return;
      }

      if (activeMembership.role === "USER") {
        router.push("/booking");
        return;
      }

      router.push("/dashboard");
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
          <div className="mb-8 flex justify-center sm:mb-10">
            <Image
              src="/logoSVG.svg"
              alt="Otman Transport"
              width={260}
              height={120}
              priority
              className="h-auto w-full"
            />
          </div>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-logoblue/30 px-3 text-sm outline-none focus:border-logoblue/60"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[20px] pl-2 font-semibold text-logoblue"
              >
                Password
              </label>
              <input
                id="password"
                required
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-logoblue/30 px-3 text-sm outline-none focus:border-logoblue/60"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg bg-logoblue text-lg font-semibold text-white hover:opacity-95 active:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-[14px] text-gray-500 hover:text-gray-700"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}