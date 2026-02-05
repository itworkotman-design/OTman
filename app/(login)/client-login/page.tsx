// app/login/page.tsx
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="w-full">
      <div className="mx-auto flex justify-center mt-30 px-4">
        <section className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="mb-8 flex justify-center sm:mb-10">
            {/* Replace with your logo path or component */}
            <Image
              src="/logo.png"
              alt="Otman Transport"
              width={260}
              height={120}
              priority
              className="h-auto w-full"
            />
          </div>

          {/* Form */}
          <form className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[20px] pl-2 font-semibold text-logoblue">
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

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[20px] pl-2 font-semibold text-logoblue">
                Password
              </label>
              <input
                id="password"
                required
                name="password"
                type="password"
                autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-logoblue/30 px-3 text-sm outline-none focus:border-logoblue/60"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="h-5 w-5 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-logoblue font-semibold cursor-pointer">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              className="h-10 w-full rounded-lg bg-logoblue text-lg font-semibold text-white hover:opacity-95 active:opacity-90 cursor-pointer"
            >
              Log in
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
